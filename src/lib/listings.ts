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
 * The seller join MUST name its foreign key explicitly. A bare
 * `seller:profiles(full_name)` fails at runtime with "more than one
 * relationship was found for 'listings' and 'profiles'": PostgREST can reach
 * profiles from listings by three paths - directly via seller_id, and
 * indirectly through wishlist_items and inquiries, which both reference the two
 * tables. Naming the constraint removes the ambiguity.
 *
 * Worth noting that `next build` and `tsc` both pass without this: the select
 * string is opaque to them, so the failure only appears when a query runs.
 */
const LISTING_SELECT = `
  *,
  seller:profiles!listings_seller_id_fkey(full_name),
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

  // The id is a tie-breaker. Rows inserted together share one created_at, and
  // Postgres makes no promise about the order of equal rows: without a second
  // key, marking one of them sold and available again visibly reshuffled the
  // grid, because the UPDATE moved the row physically.
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(60);

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
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Could not load your listings: ${error.message}`);
  }

  return (data ?? []) as unknown as Listing[];
}

/**
 * A few recent listings for the home page.
 *
 * A signed-in user gets them through the ordinary query. A signed-out visitor
 * cannot read `listings` at all - that is the point of the RLS policies - so
 * for them this calls `recent_listing_teasers()`, a database function that
 * returns only what a card shows (no seller, no description) for at most eight
 * available listings. See migration 0007 for why that narrow exception is safe.
 *
 * If that optional migration has not been applied the call fails, and this
 * returns an empty list: the home page then simply has no listings row for
 * signed-out visitors, rather than an error.
 */
export async function getRecentListings(isSignedIn: boolean): Promise<Listing[]> {
  if (isSignedIn) {
    return (await listListings()).slice(0, 8);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("recent_listing_teasers");

  if (error || !Array.isArray(data)) {
    return [];
  }

  // Shaped like a Listing so the same card component can draw it. The fields a
  // teaser does not carry are filled with harmless blanks; the card reads none
  // of them.
  return data.map((row) => ({
    id: row.id,
    seller_id: "",
    title: row.title,
    description: "",
    price: Number(row.price),
    category: row.category,
    condition: row.condition,
    status: "available",
    image_path: row.image_path,
    pickup_spot_id: null,
    course_code: row.course_code,
    semester: null,
    isbn: null,
    book_author: null,
    original_price: null,
    condition_checks: {},
    sold_at: null,
    created_at: "",
    updated_at: "",
    seller: null,
    pickup_spot: row.pickup_spot_name ? { id: "", name: row.pickup_spot_name } : null,
  })) as Listing[];
}
