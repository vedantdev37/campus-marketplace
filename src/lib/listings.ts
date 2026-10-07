import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Listing, ListingFilters, PickupSpot } from "@/lib/types/listing";

/**
 * Read queries for listings.
 *
 * Every query here runs through the request-scoped Supabase client, so it is
 * executed as the signed-in user and filtered by Row Level Security. Note what
 * that means for the owner-only requirement: these functions contain no
 * ownership logic at all, because they cannot return a row the policies would
 * refuse. `getMyListings` filters by seller_id for *correctness* (show me mine),
 * not for security.
 */

/**
 * The two joins every card and detail view needs.
 *
 * `profiles` resolves unambiguously because `listings` has exactly one foreign
 * key to it (`seller_id`); if a second were added, this would need the explicit
 * constraint name.
 */
const LISTING_SELECT = `
  *,
  seller:profiles(full_name),
  pickup_spot:pickup_spots(id, name)
`;

export async function getPickupSpots(): Promise<PickupSpot[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pickup_spots")
    .select("id, name, description, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Could not load pickup spots: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Listings matching the given filters, newest first.
 *
 * Sold listings are excluded unless `includeSold` is set: a marketplace's
 * default view is things you can still buy.
 */
export async function listListings(filters: ListingFilters = {}): Promise<Listing[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("listings").select(LISTING_SELECT);

  if (!filters.includeSold) {
    query = query.eq("status", "available");
  }

  const search = filters.search?.trim();

  if (search) {
    // Full-text search against the generated, weighted tsvector column, so a
    // title or course-code match outranks a description match.
    //
    // `websearch` parses the input the way a search engine would ("quoted
    // phrases", -excluded) and, crucially, cannot be made to throw on
    // punctuation the way `plain` can - Postgres handles arbitrary user text
    // here rather than us trying to sanitise a tsquery.
    query = query.textSearch("search_vector", search, {
      type: "websearch",
      config: "english",
    });
  }

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.condition) {
    query = query.eq("condition", filters.condition);
  }

  if (filters.pickupSpotId) {
    query = query.eq("pickup_spot_id", filters.pickupSpotId);
  }

  if (filters.semester) {
    query = query.eq("semester", filters.semester);
  }

  if (filters.courseCode) {
    // Course codes are entered inconsistently (21cs32 / 21CS32), so match
    // case-insensitively rather than exactly.
    query = query.ilike("course_code", filters.courseCode.trim());
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(60);

  if (error) {
    throw new Error(`Could not load listings: ${error.message}`);
  }

  return (data ?? []) as unknown as Listing[];
}

/** One listing, or null when it does not exist or RLS hides it. */
export async function getListing(id: string): Promise<Listing | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load listing: ${error.message}`);
  }

  return (data as unknown as Listing) ?? null;
}

/**
 * Every listing belonging to one user, sold ones included.
 *
 * Sold listings stay visible here: a seller needs to see their own history,
 * which is the opposite of what the public browse view wants.
 */
export async function getMyListings(userId: string): Promise<Listing[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load your listings: ${error.message}`);
  }

  return (data ?? []) as unknown as Listing[];
}
