/**
 * Database row shapes and their display labels.
 *
 * Hand-written rather than generated with `supabase gen types`, which needs a
 * Supabase access token this project does not hold. The trade-off is explicit:
 * these types can drift from the schema, so they are kept next to the enum
 * definitions in `supabase/migrations/0001_schema.sql` and the unions below
 * must match the Postgres enums exactly.
 */

/**
 * The enum values, as const tuples, with the TypeScript unions derived from
 * them rather than declared separately.
 *
 * One source of truth: adding a category means editing one line, and zod can
 * consume the tuple directly via z.enum() - whereas a hand-written union plus a
 * separate array can silently disagree.
 */
export const CATEGORIES = [
  "books",
  "electronics",
  "furniture",
  "hostel",
  "lab",
  "notes",
  "other",
] as const;

export const CONDITIONS = ["new", "like_new", "good", "fair", "poor"] as const;

export const STATUSES = ["available", "sold"] as const;

export type ListingCategory = (typeof CATEGORIES)[number];
export type ItemCondition = (typeof CONDITIONS)[number];
export type ListingStatus = (typeof STATUSES)[number];

/** Ordered for display. Keys must match the `listing_category` enum. */
export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  books: "Books",
  electronics: "Electronics",
  furniture: "Furniture",
  hostel: "Hostel essentials",
  lab: "Lab coats & gear",
  notes: "Notes",
  other: "Other",
};

/** Lab coat sizes. Must match the list in migration 0006. */
export const LAB_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type LabSize = (typeof LAB_SIZES)[number];

/**
 * The things a seller can confirm about an item, by category.
 *
 * Every item is worded as a POSITIVE claim: a tick always means good news
 * ("Screen free of scratches", never "Screen scratches"). That rule is what
 * lets an unticked item mean simply "not stated" - the detail page can then
 * list those neutrally, instead of an empty box reading as an admission.
 *
 * The keys are stored in the database and validated there by a trigger
 * (migration 0006), so this map and that trigger must list the same keys. The
 * LABELS are only ever read from here: the detail page looks a stored key up in
 * this map and renders the label from code, never a string from the database.
 */
export const CONDITION_CHECKS: Partial<Record<ListingCategory, { key: string; label: string }[]>> = {
  electronics: [
    { key: "charger_included", label: "Charger included" },
    { key: "battery_ok", label: "Battery holds charge" },
    { key: "screen_unscratched", label: "Screen free of scratches" },
  ],
  books: [
    { key: "no_highlighting", label: "No highlighting or notes" },
    { key: "all_pages_intact", label: "All pages intact" },
  ],
  lab: [{ key: "no_stains", label: "No stains" }],
};

/** Categories whose checklist also asks for a size. */
export const CATEGORIES_WITH_SIZE: readonly ListingCategory[] = ["lab"];

/** Stored shape: a tick is `true`; `size` is one of LAB_SIZES. */
export type ConditionChecks = Record<string, true | string>;

/** Ordered best to worst, which is also the order the filter UI shows. */
export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

/**
 * How much of the original price each condition is reasonably worth.
 *
 * Used only for the fair-price hint, and deliberately kept in code rather than
 * the database: it is a heuristic to be tuned by feel, not a fact about a row,
 * so changing it should not need a migration.
 */
export const CONDITION_VALUE_FACTOR: Record<ItemCondition, number> = {
  new: 0.9,
  like_new: 0.75,
  good: 0.6,
  fair: 0.45,
  poor: 0.3,
};

export type PickupSpot = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export type ListingRow = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  category: ListingCategory;
  condition: ItemCondition;
  status: ListingStatus;
  image_path: string | null;
  pickup_spot_id: string | null;
  course_code: string | null;
  semester: number | null;
  isbn: string | null;
  book_author: string | null;
  original_price: number | null;
  condition_checks: ConditionChecks;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A listing joined with the two things every card and detail view needs. */
export type Listing = ListingRow & {
  seller: { full_name: string } | null;
  pickup_spot: { id: string; name: string } | null;
};

/** Browse filters. Every field optional - absent means "no constraint". */
export type ListingFilters = {
  search?: string;
  category?: ListingCategory;
  condition?: ItemCondition;
  pickupSpotId?: string;
  semester?: number;
  courseCode?: string;
  /** Defaults to hiding sold listings; `true` includes them. */
  includeSold?: boolean;
};
