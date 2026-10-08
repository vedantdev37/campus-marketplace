"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import { meetupSchema, messageBodySchema, type MeetupInput } from "@/lib/validation/chat";

/**
 * Chat and meetup mutations.
 *
 * The same three layers as the listing actions, in a different shape:
 *
 *   1. The UI offers only what applies (no Accept on your own proposal).
 *   2. These actions re-read the session and re-validate the input.
 *   3. The database decides. Messages are inserted under RLS; everything that
 *      changes a conversation or a meetup is a database function that works
 *      out for itself who is calling (migration 0008).
 *
 * So unlike listings there is no `.eq("seller_id", ...)` here to forget: the
 * actions pass an id, and the function refuses it if the caller is not in that
 * conversation. scripts/verify-rls.mjs attacks those functions directly.
 */

export type ChatActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** State for the "Ask about this item" form, which keeps what was typed. */
export type AskSellerState = ChatActionState & { body?: string };

const TRY_AGAIN = "That did not go through. Check your connection and try again.";

/**
 * The database functions raise short machine-readable reasons. They are turned
 * into sentences here, so no raw database text reaches the page - and an
 * unrecognised one becomes the generic message rather than being shown.
 */
const REASONS: Record<string, string> = {
  not_signed_in: "Sign in again to continue.",
  not_participant: "That conversation is not yours.",
  listing_not_found: "That listing has been removed.",
  listing_sold: "This item has been sold, so new questions are closed.",
  own_listing: "This is your own listing.",
  spot_not_found: "Choose a pickup spot from the list.",
  meetup_in_past: "That time has already passed. Pick a later one.",
  meetup_too_far: "Pick a date within the next 60 days.",
  meetup_outside_hours: "Pick a time between 8 am and 8 pm.",
  meetup_not_acceptable:
    "That proposal can no longer be accepted. It may have been changed or its time has passed.",
  meetup_not_cancellable: "That meetup has already been cancelled or replaced.",
};

function describe(error: { message?: string } | null): string {
  return (error?.message && REASONS[error.message]) || TRY_AGAIN;
}

/** Refresh every view that shows this conversation or its meetup. */
function revalidateChatViews(conversationId: string, listingId?: string | null): void {
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath("/inbox");

  if (listingId) {
    revalidatePath(`/listings/${listingId}`);
    revalidatePath("/me");
  }
}

/**
 * "Ask about this item": opens the buyer's conversation with the seller (or
 * finds the one they already have) and posts their first message.
 */
export async function startConversationAction(
  _previous: AskSellerState,
  formData: FormData,
): Promise<AskSellerState> {
  await requireSessionUser();

  const listingId = formData.get("listingId");
  const typed = String(formData.get("body") ?? "");

  if (!isUuid(listingId)) {
    return { error: TRY_AGAIN, body: typed };
  }

  const parsed = messageBodySchema.safeParse(typed);

  if (!parsed.success) {
    return { fieldErrors: { body: parsed.error.issues[0]?.message ?? TRY_AGAIN }, body: typed };
  }

  const supabase = await createSupabaseServerClient();

  const { data: conversationId, error } = await supabase.rpc("start_conversation", {
    p_listing_id: listingId,
    p_body: parsed.data,
  });

  if (error || !isUuid(conversationId)) {
    console.error("Could not start conversation", { message: error?.message });
    return { error: describe(error), body: typed };
  }

  revalidateChatViews(conversationId, listingId);

  // redirect() throws, so it must come after the work and outside any try/catch.
  redirect(`/inbox/${conversationId}`);
}

export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
}): Promise<ChatActionState> {
  await requireSessionUser();

  if (!isUuid(input.conversationId)) {
    return { error: TRY_AGAIN };
  }

  const parsed = messageBodySchema.safeParse(input.body);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? TRY_AGAIN };
  }

  const supabase = await createSupabaseServerClient();

  // Only the conversation and the text are sent. The sender, the kind and the
  // timestamp are column defaults that a client has no privilege to set.
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: input.conversationId, body: parsed.data })
    .select("id");

  if (error || (data?.length ?? 0) === 0) {
    console.error("Could not send message", { message: error?.message });
    // 42501 is how RLS refuses an insert: the conversation is not the caller's.
    return { error: error?.code === "42501" ? REASONS.not_participant : TRY_AGAIN };
  }

  revalidateChatViews(input.conversationId);
  return {};
}

/**
 * Propose a meetup. Also "Suggest another time" and "Change": the database
 * function retires whatever meetup is currently active in the same transaction.
 */
export async function proposeMeetupAction(
  input: MeetupInput & { conversationId: string; listingId: string },
): Promise<ChatActionState> {
  await requireSessionUser();

  if (!isUuid(input.conversationId)) {
    return { error: TRY_AGAIN };
  }

  // Parsed against the server's clock: "in the future" must not depend on what
  // time the browser believes it is.
  const parsed = meetupSchema(new Date()).safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("propose_meetup", {
    p_conversation_id: input.conversationId,
    p_pickup_spot_id: parsed.data.pickupSpotId,
    p_meet_at: parsed.data.meetAt,
  });

  if (error) {
    console.error("Could not propose meetup", { message: error.message });
    return { error: describe(error) };
  }

  revalidateChatViews(input.conversationId, isUuid(input.listingId) ? input.listingId : null);
  return {};
}

async function changeMeetup(
  fn: "accept_meetup" | "cancel_meetup",
  input: { meetupId: string; conversationId: string; listingId: string },
): Promise<ChatActionState> {
  await requireSessionUser();

  if (!isUuid(input.meetupId) || !isUuid(input.conversationId)) {
    return { error: TRY_AGAIN };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(fn, { p_meetup_id: input.meetupId });

  if (error) {
    console.error(`Could not ${fn}`, { message: error.message });
    return { error: describe(error) };
  }

  revalidateChatViews(input.conversationId, isUuid(input.listingId) ? input.listingId : null);
  return {};
}

export async function acceptMeetupAction(input: {
  meetupId: string;
  conversationId: string;
  listingId: string;
}): Promise<ChatActionState> {
  return changeMeetup("accept_meetup", input);
}

export async function cancelMeetupAction(input: {
  meetupId: string;
  conversationId: string;
  listingId: string;
}): Promise<ChatActionState> {
  return changeMeetup("cancel_meetup", input);
}
