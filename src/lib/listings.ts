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
 * profiles from listings by more than one path - directly via seller_id, and
 * indirectly through tables that reference both, such as wishlist_items and
 * conversations. Naming the constraint removes the ambiguity.
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

  // Always scoped to a kind of post. A row of another type drawn by a page
  // that was not expecting it would be shown as a 0-rupee sale.
  query = query.in("type", filters.types ?? ["sale"]);

  if (filters.tag) {
    query = query.contains("tags", [filters.tag]);
  }

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

type TeaserRow = {
  id: string;
  title: string;
  price: number | string;
  status?: Listing["status"];
  type?: Listing["type"];
  rent_max_days?: number | null;
  found_on?: string | null;
  event_name?: string | null;
  event_date?: string | null;
  tags?: string[];
  category?: Listing["category"];
  condition?: Listing["condition"];
  image_path: string | null;
  course_code?: string | null;
  pickup_spot_name: string | null;
};

/**
 * A teaser row, shaped like a Listing so the same card component can draw it.
 * The fields a teaser does not carry are filled with harmless blanks; the card
 * reads none of them.
 */
function teaserToListing(row: TeaserRow): Listing {
  return {
    id: row.id,
    seller_id: "",
    title: row.title,
    description: "",
    price: Number(row.price),
    category: row.category ?? "other",
    condition: row.condition ?? "good",
    type: row.type ?? "sale",
    rent_max_days: row.rent_max_days ?? null,
    found_on: row.found_on ?? null,
    event_name: row.event_name ?? null,
    event_date: row.event_date ?? null,
    tags: row.tags ?? [],
    status: row.status ?? "available",
    image_path: row.image_path,
    pickup_spot_id: null,
    course_code: row.course_code ?? null,
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
  };
}

/**
 * A few recent listings for the home page: up to seven that are for sale, and
 * the most recently sold one, so the page can show what "sold" looks like.
 *
 * The home page is public, and a signed-out visitor cannot read `listings` at
 * all - that is the point of the RLS policies. So this calls
 * `home_listing_teasers()`, a database function that returns only what a card
 * shows (no seller, no description). Migration 0009 explains why that narrow
 * exception is safe. Signed-in visitors get the same rows the same way, so the
 * page looks identical whether or not you are signed in.
 *
 * If 0009 has not been applied, it falls back to the older
 * `recent_listing_teasers()` (available listings only); if that is missing
 * too, to an empty list. The page then has fewer cards, not an error.
 */
export async function getRecentListings(): Promise<Listing[]> {
  const supabase = await createSupabaseServerClient();

  const current = await supabase.rpc("home_listing_teasers");

  if (!current.error && Array.isArray(current.data)) {
    return (current.data as TeaserRow[]).map(teaserToListing);
  }

  const older = await supabase.rpc("recent_listing_teasers");

  if (!older.error && Array.isArray(older.data)) {
    return (older.data as TeaserRow[]).map(teaserToListing);
  }

  return [];
}

/**
 * The newest open posts of each kind other than sale, for the home page's
 * Rent, Free, Squad up and Lost & Found sections: `home_sections()` from
 * migration 0010, which returns card fields and no seller. Empty if it cannot
 * be read, and the page then leaves those sections out.
 */
export async function getHomeSections(): Promise<Listing[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("home_sections");

  return error || !Array.isArray(data) ? [] : (data as TeaserRow[]).map(teaserToListing);
}

/** The live numbers on the home page, from `public_stats()` (migration 0009). */
export type PublicStats = {
  listings_live: number;
  items_sold: number;
  pickup_spots: number;
  meetups_agreed: number;
  students: number;
};

/**
 * Counts for the home page's proof strip, or null if they cannot be read.
 *
 * Null is a real answer the page handles: it then shows no live counters at
 * all. It never substitutes a made-up number for one it could not fetch.
 */
export async function getPublicStats(): Promise<PublicStats | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_stats");

  const row = Array.isArray(data) ? data[0] : data;

  if (error || !row || typeof row.listings_live !== "number") {
    return null;
  }

  return row as PublicStats;
}

/** Pickup spot names for the public home page, or an empty list. */
export async function getPublicPickupSpots(): Promise<{ name: string; description: string | null }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_pickup_spots");

  return error || !Array.isArray(data) ? [] : data;
}
