import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AcceptedMeetup, Conversation, InboxRow, Meetup, Message } from "@/lib/types/chat";

/**
 * Read queries for chat and meetups.
 *
 * As in lib/listings.ts, none of these contain an "is this user allowed?"
 * check: they run as the signed-in user, and the policies in migration 0008
 * return a conversation, its messages and its meetups to its buyer and seller
 * and to nobody else. A conversation id belonging to two other people simply
 * comes back as null.
 *
 * Every embed names its foreign key. `conversations` reaches `profiles` twice
 * (buyer and seller), so a bare `profiles(...)` is ambiguous - and that
 * failure only appears when the query runs, not at build time.
 */

const MEETUP_SELECT = `
  id, conversation_id, proposed_by, pickup_spot_id, meet_at, status,
  pickup_spot:pickup_spots!meetups_pickup_spot_id_fkey(name)
`;

/** The most recent messages a thread shows. Older ones are not loaded. */
const THREAD_LIMIT = 200;

/** My conversations, most recently active first, optionally for one listing. */
export async function getInbox(listingId?: string): Promise<InboxRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_inbox");

  if (error) {
    throw new Error(`Could not load your inbox: ${error.message}`);
  }

  const rows = ((data ?? []) as InboxRow[]).map((row) => ({
    ...row,
    listing_price: Number(row.listing_price),
  }));

  return listingId ? rows.filter((row) => row.listing_id === listingId) : rows;
}

/** One conversation, or null when it does not exist or is not mine. */
export async function getConversation(id: string): Promise<Conversation | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      id, listing_id, buyer_id, seller_id,
      listing:listings!conversations_listing_id_fkey(id, title, price, status, image_path, pickup_spot_id),
      buyer:profiles!conversations_buyer_id_fkey(full_name),
      seller:profiles!conversations_seller_id_fkey(full_name)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the conversation: ${error.message}`);
  }

  return (data as unknown as Conversation) ?? null;
}

/** A conversation's messages, oldest first. */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id, sender_id, kind, body, created_at,
      meetup:meetups!messages_meetup_id_fkey(${MEETUP_SELECT})
    `,
    )
    .eq("conversation_id", conversationId)
    // Newest first so the limit keeps the END of a long thread, then reversed
    // for display. The id breaks ties, as it does for listings.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(THREAD_LIMIT);

  if (error) {
    throw new Error(`Could not load messages: ${error.message}`);
  }

  return ((data ?? []) as unknown as Message[]).reverse();
}

/** The conversation's pending or accepted meetup. There is at most one. */
export async function getActiveMeetup(conversationId: string): Promise<Meetup | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("meetups")
    .select(MEETUP_SELECT)
    .eq("conversation_id", conversationId)
    .in("status", ["proposed", "accepted"])
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the meetup: ${error.message}`);
  }

  return (data as unknown as Meetup) ?? null;
}

/**
 * What the listing page needs to know about chat, for the person looking.
 *
 * A buyer has at most one conversation on a listing; its seller has one per
 * interested buyer. Both arrive through the same query, because RLS hands each
 * of them only the conversations they are part of.
 */
export async function getListingChat(
  listingId: string,
  userId: string,
): Promise<{ conversationIds: string[]; acceptedMeetups: AcceptedMeetup[] }> {
  const supabase = await createSupabaseServerClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `
      id, buyer_id,
      buyer:profiles!conversations_buyer_id_fkey(full_name),
      seller:profiles!conversations_seller_id_fkey(full_name)
    `,
    )
    .eq("listing_id", listingId)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load conversations: ${error.message}`);
  }

  const rows = (conversations ?? []) as unknown as {
    id: string;
    buyer_id: string;
    buyer: { full_name: string } | null;
    seller: { full_name: string } | null;
  }[];

  if (rows.length === 0) {
    return { conversationIds: [], acceptedMeetups: [] };
  }

  const { data: meetups, error: meetupsError } = await supabase
    .from("meetups")
    .select(MEETUP_SELECT)
    .in(
      "conversation_id",
      rows.map((row) => row.id),
    )
    .eq("status", "accepted")
    .order("meet_at", { ascending: true });

  if (meetupsError) {
    throw new Error(`Could not load meetups: ${meetupsError.message}`);
  }

  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    conversationIds: rows.map((row) => row.id),
    acceptedMeetups: ((meetups ?? []) as unknown as Meetup[]).map((meetup) => {
      const conversation = byId.get(meetup.conversation_id);
      const other = conversation?.buyer_id === userId ? conversation?.seller : conversation?.buyer;

      return {
        id: meetup.id,
        conversationId: meetup.conversation_id,
        spotName: meetup.pickup_spot?.name ?? "the agreed spot",
        meetAt: meetup.meet_at,
        withName: other?.full_name ?? "the other student",
      };
    }),
  };
}
