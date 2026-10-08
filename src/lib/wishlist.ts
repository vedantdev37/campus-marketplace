import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types/listing";

/**
 * Saved posts ("wishlist").
 *
 * The table and its policies date from the first migration: a row is
 * (user_id, listing_id), the pair is the primary key so a post cannot be saved
 * twice, and RLS lets you select, insert and delete only rows whose user_id is
 * you. So these queries need no "is it mine?" filter to be private - a
 * wishlist is private because nobody else's rows are ever returned. The
 * `.eq("user_id", ...)` below is there for the index, not for safety.
 */

/** The ids of every post I have saved. */
export async function getSavedIds(userId: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("listing_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Could not load saved posts: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.listing_id as string));
}

/** The posts I have saved, most recently saved first, finished ones included. */
export async function getSavedListings(userId: string): Promise<Listing[]> {
  const supabase = await createSupabaseServerClient();

  const { data: saved, error } = await supabase
    .from("wishlist_items")
    .select("listing_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load saved posts: ${error.message}`);
  }

  const ids = (saved ?? []).map((row) => row.listing_id as string);

  if (ids.length === 0) {
    return [];
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("*, seller:profiles!listings_seller_id_fkey(full_name), pickup_spot:pickup_spots(id, name)")
    .in("id", ids);

  if (listingsError) {
    throw new Error(`Could not load saved posts: ${listingsError.message}`);
  }

  // Back into the order they were saved in.
  const byId = new Map(((listings ?? []) as unknown as Listing[]).map((listing) => [listing.id, listing]));
  return ids.map((id) => byId.get(id)).filter((listing): listing is Listing => Boolean(listing));
}
