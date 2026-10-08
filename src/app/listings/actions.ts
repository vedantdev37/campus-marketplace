"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { LISTING_IMAGE_BUCKET } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isListingType,
  STATUSES,
  TYPE_INFO,
  type ConditionChecks,
  type ListingStatus,
  type ListingType,
} from "@/lib/types/listing";
import { isUuid } from "@/lib/uuid";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import {
  listingSchema,
  readConditionChecks,
  readTypeExtras,
  type ListingInput,
  type TypeExtras,
} from "@/lib/validation/listing";

/**
 * Owner-only mutations on a listing.
 *
 * Three independent layers guard these, and each would be sufficient at the
 * data layer on its own:
 *
 *   1. The UI only renders the controls for the owner.
 *   2. These actions re-read the session and scope the query by seller_id.
 *   3. RLS refuses the row regardless of what the query asks for.
 *
 * Layer 1 is convenience. Layer 2 exists so a misconfigured policy is not the
 * only thing standing between a crafted request and someone else's data. Layer 3
 * is the guarantee - see scripts/verify-rls.mjs, which proves it by attacking
 * the API directly as a non-owner.
 *
 * Note that layer 2 cannot be skipped on the grounds that RLS handles it: these
 * run with the user's own token, so a missing `.eq("seller_id", ...)` would be
 * relying entirely on the policy being correct today and tomorrow.
 */

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** State handed back to the listing form after a failed submit. */
export type ListingFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
};

/** State handed back to the owner controls (mark sold, delete). */
export type OwnerActionState = {
  error?: string;
};

const CHECKLIST_REJECTED =
  "The condition details did not match this category. Reload the page and try again.";
const PHOTO_REQUIRED = "Add a photo of the item before saving.";
const NOT_YOURS = "That listing is not yours to change.";
const TRY_AGAIN = "That did not go through. Check your connection and try again.";

/**
 * The listing id from a hidden input, or null when it is not a UUID.
 *
 * A malformed id means the form was tampered with rather than mistyped, so it
 * is refused before any query runs. It is returned as null rather than thrown:
 * a thrown error lands the user on the generic error page, while a returned one
 * can be shown next to the button they pressed.
 */
function readListingId(formData: FormData): string | null {
  const id = formData.get("id");
  return isUuid(id) ? id : null;
}

/** Refresh every view that could be showing this listing. */
function revalidateListingViews(id: string): void {
  revalidatePath(`/listings/${id}`);
  revalidatePath("/explore");
  revalidatePath("/me");
  revalidatePath("/");
}

/**
 * Best-effort removal of a listing photo from Storage.
 *
 * Failure is logged and swallowed on purpose: by the time this runs the row has
 * already changed, and an orphaned file is a far smaller problem than telling
 * the user their edit failed when it did not. The Storage policy still applies,
 * so this can only ever remove a file in the caller's own folder.
 */
async function removeStoredImage(supabase: ServerSupabase, path: string | null) {
  if (!path) {
    return;
  }

  const { error } = await supabase.storage.from(LISTING_IMAGE_BUCKET).remove([path]);

  if (error) {
    console.error("Could not remove listing image", { path, message: error.message });
  }
}

/**
 * The raw strings from the form, in the shape listingSchema expects.
 *
 * What a type does not have is set here, not read from the request: a post
 * that is not a physical item gets the neutral category and condition, a post
 * with no price gets 0, and only a sale keeps the bookshop fields. The form
 * hides those inputs, but hiding is not what makes it so.
 */
function readListingFields(formData: FormData, type: ListingType) {
  const text = (name: string) => String(formData.get(name) ?? "");
  const info = TYPE_INFO[type];
  const isSale = type === "sale";

  return {
    title: text("title"),
    description: text("description"),
    price: info.hasPrice ? text("price") : "0",
    category: info.isItem ? text("category") : "other",
    condition: info.isItem ? text("condition") : "good",
    pickupSpotId: text("pickupSpotId"),
    courseCode: isSale ? text("courseCode") : "",
    semester: isSale ? text("semester") : "",
    isbn: isSale ? text("isbn") : "",
    bookAuthor: isSale ? text("bookAuthor") : "",
    originalPrice: isSale ? text("originalPrice") : "",
  };
}

/**
 * The submitted image path, or null for "no photo".
 *
 * The photo is uploaded by the browser straight to Storage (a Server Action
 * body is capped at 1 MB by default, well under a phone photo), so what arrives
 * here is only a path - and a path is just a string the client chose. It is
 * accepted only if it sits inside the caller's own `<uid>/` folder and looks
 * like a file this app would have written. Without this check a user could
 * point their listing at another user's object.
 *
 * Returns undefined when a value is present but not acceptable.
 */
function readImagePath(formData: FormData, userId: string): string | null | undefined {
  const raw = String(formData.get("imagePath") ?? "").trim();

  if (raw === "") {
    return null;
  }

  const [folder, fileName, ...rest] = raw.split("/");

  const isOwnFolder = folder === userId;
  const isPlainFile = rest.length === 0 && /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(fileName ?? "");

  return isOwnFolder && isPlainFile ? raw : undefined;
}

/** Validated form input -> column names. */
function toListingColumns(
  input: ListingInput,
  imagePath: string | null,
  conditionChecks: ConditionChecks,
  extras: TypeExtras,
) {
  return {
    ...extras,
    condition_checks: conditionChecks,
    title: input.title,
    description: input.description,
    price: input.price,
    category: input.category,
    condition: input.condition,
    pickup_spot_id: input.pickupSpotId,
    // Stored upper-case so 21cs32 and 21CS32 are the same course when filtering.
    course_code: input.courseCode ? input.courseCode.toUpperCase() : null,
    semester: input.semester,
    isbn: input.isbn,
    book_author: input.bookAuthor,
    original_price: input.originalPrice,
    image_path: imagePath,
  };
}

export async function createListingAction(
  _previous: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireSessionUser();

  // Which of the six kinds of post this is. Anything unrecognised is refused,
  // not quietly treated as a sale.
  const submittedType = formData.get("type") ?? "sale";

  if (!isListingType(submittedType)) {
    return { formError: "That kind of post does not exist. Go back and choose one." };
  }

  const type = submittedType;

  // Re-parsed here with the same schema the form used. The form's pass is for
  // feedback; this one is the gate, because a request can be built by hand.
  const parsed = listingSchema.safeParse(readListingFields(formData, type));
  const typed = readTypeExtras(type, formData);

  if (!parsed.success || "fieldErrors" in typed) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...("fieldErrors" in typed ? typed.fieldErrors : {}),
      },
    };
  }

  const imagePath = readImagePath(formData, user.id);

  if (imagePath === undefined) {
    return { formError: "That photo could not be attached. Please choose it again." };
  }

  // A post about a physical thing must show it. The form checks this too, but
  // a request built by hand skips the form. A skill or a call for teammates
  // has nothing to photograph, so there it is optional.
  if (imagePath === null && TYPE_INFO[type].photoRequired) {
    return { formError: PHOTO_REQUIRED };
  }

  // Validated against the checklist for THIS category, strictly: a key from
  // another category is an error, not something quietly stored.
  const conditionChecks = readConditionChecks(parsed.data.category, formData);

  if (conditionChecks === null) {
    return { formError: CHECKLIST_REJECTED };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("listings")
    // seller_id comes from the session, never from the form. RLS would refuse a
    // mismatched value anyway (WITH CHECK seller_id = auth.uid()).
    .insert({
      ...toListingColumns(parsed.data, imagePath, conditionChecks, typed.extras),
      type,
      seller_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Could not create listing", { message: error?.message });
    return { formError: "Could not save the listing. Please try again." };
  }

  revalidateListingViews(data.id);

  // redirect() throws, so it must come after the work and outside any try/catch.
  redirect(`/listings/${data.id}`);
}

export async function updateListingAction(
  _previous: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireSessionUser();
  const id = readListingId(formData);

  if (id === null) {
    return { formError: "That listing could not be found. Go back and try again." };
  }

  const supabase = await createSupabaseServerClient();

  // Read the current row first, scoped to the owner. Its photo is needed so a
  // replaced one can be cleaned out of Storage afterwards - and its TYPE is
  // taken from here, never from the form: a post cannot change kind, and the
  // database refuses an update that tries (migration 0010).
  const { data: existing, error: readError } = await supabase
    .from("listings")
    .select("image_path, type")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (readError) {
    console.error("Could not load listing for edit", { message: readError.message });
    return { formError: "Could not save the listing. Please try again." };
  }

  if (!existing || !isListingType(existing.type)) {
    return { formError: "That listing is not yours to edit." };
  }

  const type = existing.type;

  const parsed = listingSchema.safeParse(readListingFields(formData, type));
  const typed = readTypeExtras(type, formData);

  if (!parsed.success || "fieldErrors" in typed) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...("fieldErrors" in typed ? typed.fieldErrors : {}),
      },
    };
  }

  const imagePath = readImagePath(formData, user.id);

  if (imagePath === undefined) {
    return { formError: "That photo could not be attached. Please choose it again." };
  }

  // Re-derived from the submitted category, so switching a listing from
  // Electronics to Books drops the electronics ticks rather than keeping them.
  const conditionChecks = readConditionChecks(parsed.data.category, formData);

  if (conditionChecks === null) {
    return { formError: CHECKLIST_REJECTED };
  }

  // An edit may keep its photo or replace it, but may not strip it. A listing
  // that predates the rule and never had a photo is left alone.
  if (existing.image_path && imagePath === null) {
    return { formError: PHOTO_REQUIRED };
  }

  const { data: updated, error } = await supabase
    .from("listings")
    // status and seller_id are deliberately not part of an edit: status changes
    // go through setListingStatusAction, and ownership never changes.
    .update(toListingColumns(parsed.data, imagePath, conditionChecks, typed.extras))
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id");

  if (error) {
    console.error("Could not update listing", { message: error.message });
    return { formError: "Could not save the listing. Please try again." };
  }

  // Zero rows with no error is how RLS says no.
  if ((updated?.length ?? 0) === 0) {
    return { formError: "That listing is not yours to edit." };
  }

  if (existing.image_path && existing.image_path !== imagePath) {
    await removeStoredImage(supabase, existing.image_path);
  }

  revalidateListingViews(id);
  redirect(`/listings/${id}`);
}

/**
 * Mark a listing sold, or available again.
 *
 * Failures are RETURNED, not thrown. These used to throw, which sent the owner
 * to the full-page error boundary for something as ordinary as a dropped
 * connection - losing the page they were on. A returned message is shown next
 * to the button instead, and they can simply press it again.
 */
export async function setListingStatusAction(
  _previous: OwnerActionState,
  formData: FormData,
): Promise<OwnerActionState> {
  const user = await requireSessionUser();
  const id = readListingId(formData);

  const requested = String(formData.get("status") ?? "");

  if (id === null || !(STATUSES as readonly string[]).includes(requested)) {
    return { error: TRY_AGAIN };
  }

  const status = requested as ListingStatus;

  const supabase = await createSupabaseServerClient();

  // sold_at is deliberately not sent: the listings_before_update trigger derives
  // it from the status transition, so the client cannot back-date a sale.
  const { data, error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id");

  if (error) {
    console.error("Could not update listing status", { message: error.message });
    return { error: TRY_AGAIN };
  }

  // A blocked UPDATE under RLS does not error - the row simply falls outside the
  // policy and nothing matches. Checking the row count is the only way to tell
  // "not allowed" from "done".
  if ((data?.length ?? 0) === 0) {
    return { error: NOT_YOURS };
  }

  revalidateListingViews(id);
  return {};
}

export async function deleteListingAction(
  _previous: OwnerActionState,
  formData: FormData,
): Promise<OwnerActionState> {
  const user = await requireSessionUser();
  const id = readListingId(formData);

  if (id === null) {
    return { error: TRY_AGAIN };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id, image_path");

  if (error) {
    console.error("Could not delete listing", { message: error.message });
    return { error: TRY_AGAIN };
  }

  if ((data?.length ?? 0) === 0) {
    return { error: NOT_YOURS };
  }

  // The photo goes with the listing, so Storage does not fill with orphans.
  await removeStoredImage(supabase, data?.[0]?.image_path ?? null);

  revalidateListingViews(id);

  // redirect() throws, so it must come after the work and outside any try/catch.
  redirect("/me");
}
