import {
  CATEGORIES,
  CONDITIONS,
  type ItemCondition,
  type ListingCategory,
  type ListingFilters,
} from "@/lib/types/listing";

type SearchParamValue = string | string[] | undefined;
export type RawSearchParams = Record<string, SearchParamValue>;

/** A repeated query parameter arrives as an array; take the first value. */
function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Turns URL search params into filters.
 *
 * Anything unrecognised is dropped rather than passed through. That is not
 * tidiness - `?category=nonsense` forwarded to Postgres would fail the
 * `listing_category` enum comparison and surface as a 500, and `?semester=abc`
 * would become NaN. Validating at the boundary means a hand-edited URL yields an
 * unfiltered page instead of an error page.
 */
export function parseListingFilters(params: RawSearchParams): ListingFilters {
  const filters: ListingFilters = {};

  const search = first(params.q)?.trim();
  if (search) {
    filters.search = search;
  }

  const category = first(params.category);
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    filters.category = category as ListingCategory;
  }

  const condition = first(params.condition);
  if (condition && (CONDITIONS as readonly string[]).includes(condition)) {
    filters.condition = condition as ItemCondition;
  }

  // Checked against the UUID shape only; a well-formed id that does not exist
  // simply matches nothing, which is the correct outcome.
  const spot = first(params.spot)?.trim();
  if (spot && /^[0-9a-f-]{36}$/i.test(spot)) {
    filters.pickupSpotId = spot;
  }

  const semester = Number(first(params.semester));
  if (Number.isInteger(semester) && semester >= 1 && semester <= 8) {
    filters.semester = semester;
  }

  const course = first(params.course)?.trim();
  if (course && /^[A-Za-z0-9]{2,12}$/.test(course)) {
    filters.courseCode = course;
  }

  if (first(params.sold) === "1") {
    filters.includeSold = true;
  }

  return filters;
}

/** True when the user has narrowed the view at all. */
export function hasActiveFilters(filters: ListingFilters): boolean {
  return Object.keys(filters).length > 0;
}
