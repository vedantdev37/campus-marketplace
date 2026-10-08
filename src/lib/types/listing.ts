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

/**
 * The six kinds of post. Must match the `listings_type_known` CHECK in
 * migration 0010. They share one table, one card, one detail page and one
 * chat; what differs is collected in TYPE_INFO below.
 */
export const LISTING_TYPES = [
  "sale",
  "rent",
  "free",
  "lost_found",
  "skill_offer",
  "team_request",
] as const;

export type ListingType = (typeof LISTING_TYPES)[number];

export function isListingType(value: unknown): value is ListingType {
  return typeof value === "string" && (LISTING_TYPES as readonly string[]).includes(value);
}

/**
 * Everything that varies by type, in one place.
 *
 * `closed` is the label for the one stored end state, `status = 'sold'`. A
 * rental that is out, a found item that was claimed and a team that is full
 * are the same state under different names (migration 0010 explains why the
 * status column was not extended).
 *
 * `action` is the button on someone else's post. Every one of them opens a
 * chat with `opener` already typed: nothing is booked, reserved or paid for
 * through this site, and no label says otherwise.
 */
export const TYPE_INFO: Record<
  ListingType,
  {
    /** The word on the badge. Always shown, so type never depends on colour. */
    badge: string;
    /** The tile on the Post page. */
    post: string;
    postHint: string;
    closed: string;
    closeVerb: string;
    reopenVerb: string;
    action: string;
    opener: string;
    /** Is it a physical thing, with a category and a condition? */
    isItem: boolean;
    hasPrice: boolean;
    photoRequired: boolean;
  }
> = {
  sale: {
    badge: "Sale",
    post: "Sell it",
    postHint: "Books, calculators, hostel gear",
    closed: "Sold",
    closeVerb: "Mark as sold",
    reopenVerb: "Mark as available",
    action: "Ask seller",
    opener: "Hi! Is this still available?",
    isItem: true,
    hasPrice: true,
    photoRequired: true,
  },
  rent: {
    badge: "Rent",
    post: "Rent it out",
    postHint: "Per day, for a drafter or a lab coat",
    closed: "Rented out",
    closeVerb: "Mark as rented out",
    reopenVerb: "Mark as returned",
    action: "Rent it",
    opener: "Hi! I would like to rent this. Is it free this week?",
    isItem: true,
    hasPrice: true,
    photoRequired: true,
  },
  free: {
    badge: "Free",
    post: "Give it away",
    postHint: "No money, just a good home",
    closed: "Claimed",
    closeVerb: "Mark as claimed",
    reopenVerb: "Mark as available",
    action: "Claim it",
    opener: "Hi! Is this still up for grabs? I can collect it.",
    isItem: true,
    hasPrice: false,
    photoRequired: true,
  },
  lost_found: {
    badge: "Lost & Found",
    post: "Found something",
    postHint: "Help it get back to its owner",
    closed: "Claimed",
    closeVerb: "Mark as returned to owner",
    reopenVerb: "Mark as still unclaimed",
    action: "That's mine",
    opener: "Hi! I think this is mine. I can describe it to prove it.",
    isItem: false,
    hasPrice: false,
    photoRequired: true,
  },
  skill_offer: {
    badge: "Skill",
    post: "Offer a skill",
    postHint: "Editing, design, tutoring, code",
    closed: "Not available",
    closeVerb: "Mark as not available",
    reopenVerb: "Mark as available",
    action: "Hire",
    opener: "Hi! I am interested in this. Can we talk about what I need?",
    isItem: false,
    hasPrice: false,
    photoRequired: false,
  },
  team_request: {
    badge: "Team",
    post: "Find teammates",
    postHint: "For a hackathon, a fest, a project",
    closed: "Team full",
    closeVerb: "Mark team as full",
    reopenVerb: "Reopen",
    action: "I'm in",
    opener: "Hi! I am interested in joining. Here is what I can do:",
    isItem: false,
    hasPrice: false,
    photoRequired: false,
  },
};

/** Explore tabs. "Squad up" shows two types together. */
export const EXPLORE_TABS = [
  { key: "buy", label: "Buy", types: ["sale"] },
  { key: "rent", label: "Rent", types: ["rent"] },
  { key: "free", label: "Free", types: ["free"] },
  { key: "squad", label: "Squad up", types: ["skill_offer", "team_request"] },
  { key: "found", label: "Lost & Found", types: ["lost_found"] },
] as const satisfies readonly { key: string; label: string; types: readonly ListingType[] }[];

export type ExploreTab = (typeof EXPLORE_TABS)[number]["key"];

/** Must match the tag rule in migration 0010. */
export const MAX_TAGS = 8;
export const RENT_MAX_DAYS = 30;

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
  // Not "Fair" and "Poor": the stored values keep those names, but on screen
  // "Fair" sat next to the deal meter's "Fair price" and meant something else.
  fair: "Used",
  poor: "Heavily used",
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
  type: ListingType;
  rent_max_days: number | null;
  found_on: string | null;
  event_name: string | null;
  event_date: string | null;
  tags: string[];
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
  /** Which kinds of post. Absent means sales, the original behaviour. */
  types?: readonly ListingType[];
  /** A skill tag, for Squad up. */
  tag?: string;
  search?: string;
  category?: ListingCategory;
  condition?: ItemCondition;
  pickupSpotId?: string;
  semester?: number;
  courseCode?: string;
  /** Defaults to hiding sold listings; `true` includes them. */
  includeSold?: boolean;
};
