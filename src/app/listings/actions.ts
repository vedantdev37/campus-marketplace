"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STATUSES, type ListingStatus } from "@/lib/types/listing";

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

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

function readListingId(formData: FormData): string {
  const id = String(formData.get("id") ?? "");

  if (!UUID_PATTERN.test(id)) {
    // The id comes from a hidden input, so a malformed one means the form was
    // tampered with rather than mistyped. Fail rather than query.
    throw new Error("Invalid listing id.");
  }

  return id;
}

/** Refresh every view that could be showing this listing. */
function revalidateListingViews(id: string): void {
  revalidatePath(`/listings/${id}`);
  revalidatePath("/listings");
  revalidatePath("/listings/mine");
}

export async function setListingStatusAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  const id = readListingId(formData);

  const requested = String(formData.get("status") ?? "");

  if (!(STATUSES as readonly string[]).includes(requested)) {
    throw new Error("Invalid status.");
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
    throw new Error(`Could not update the listing: ${error.message}`);
  }

  // A blocked UPDATE under RLS does not error - the row simply falls outside the
  // policy and nothing matches. Checking the row count is the only way to tell
  // "not allowed" from "done".
  if ((data?.length ?? 0) === 0) {
    throw new Error("That listing is not yours to change.");
  }

  revalidateListingViews(id);
}

export async function deleteListingAction(formData: FormData): Promise<void> {
  const user = await requireSessionUser();
  const id = readListingId(formData);

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id");

  if (error) {
    throw new Error(`Could not delete the listing: ${error.message}`);
  }

  if ((data?.length ?? 0) === 0) {
    throw new Error("That listing is not yours to delete.");
  }

  revalidateListingViews(id);

  // redirect() throws, so it must come after the work and outside any try/catch.
  redirect("/listings/mine");
}
