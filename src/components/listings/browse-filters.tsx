import Link from "next/link";

import {
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITIONS,
  CONDITION_LABELS,
  type ListingFilters,
  type PickupSpot,
} from "@/lib/types/listing";

const SELECT_CLASS =
  "h-12 w-full rounded-lg border border-control-border bg-canvas px-3 text-base text-ink";

/**
 * Browse filters as a plain GET form.
 *
 * Deliberately a Server Component with no JavaScript: the form submits to the
 * same route and the filters live in the URL. That buys several things for free
 * which a client-side filter would have to rebuild - a filtered view is
 * shareable and bookmarkable, the back button works, and it all functions before
 * (or without) JS. The server already has to filter for RLS reasons anyway, so
 * doing it in the browser as well would be duplicate logic.
 */
export function BrowseFilters({
  filters,
  pickupSpots,
}: {
  filters: ListingFilters;
  pickupSpots: PickupSpot[];
}) {
  const hasAnyFilter =
    Boolean(filters.search) ||
    Boolean(filters.category) ||
    Boolean(filters.condition) ||
    Boolean(filters.pickupSpotId) ||
    Boolean(filters.semester) ||
    Boolean(filters.courseCode) ||
    Boolean(filters.includeSold);

  return (
    <form method="get" className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filters.search ?? ""}
          placeholder="Search listings…"
          autoComplete="off"
          aria-label="Search listings"
          className="h-12 min-w-0 flex-1 rounded-lg border border-control-border bg-canvas px-3.5 text-base text-ink placeholder:text-ink-muted"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-lg bg-accent px-5 text-base font-medium text-on-accent hover:bg-accent-active"
        >
          Search
        </button>
      </div>

      <details className="rounded-lg border border-border bg-surface" open={hasAnyFilter}>
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-base font-medium">
          Filters
        </summary>

        <div className="grid grid-cols-1 gap-3 border-t border-border p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Category
            <select name="category" defaultValue={filters.category ?? ""} className={SELECT_CLASS}>
              <option value="">Any</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Condition
            <select name="condition" defaultValue={filters.condition ?? ""} className={SELECT_CLASS}>
              <option value="">Any</option>
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {CONDITION_LABELS[condition]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Pickup spot
            <select name="spot" defaultValue={filters.pickupSpotId ?? ""} className={SELECT_CLASS}>
              <option value="">Anywhere on campus</option>
              {pickupSpots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Semester
            <select name="semester" defaultValue={filters.semester?.toString() ?? ""} className={SELECT_CLASS}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Course code
            <input
              type="text"
              name="course"
              defaultValue={filters.courseCode ?? ""}
              placeholder="e.g. 21CS32…"
              autoComplete="off"
              spellCheck={false}
              className={SELECT_CLASS}
            />
          </label>

          <label className="flex min-h-12 items-center gap-3 self-end text-base">
            <input
              type="checkbox"
              name="sold"
              value="1"
              defaultChecked={Boolean(filters.includeSold)}
              className="size-6 accent-(--ds-ink)"
            />
            Include sold items
          </label>

          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="h-12 flex-1 rounded-lg bg-accent px-5 text-base font-medium text-on-accent hover:bg-accent-active"
            >
              Apply filters
            </button>

            {hasAnyFilter ? (
              <Link
                href="/listings"
                className="flex h-12 items-center rounded-lg border border-ink px-5 text-base font-medium text-ink hover:bg-surface-soft"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </div>
      </details>
    </form>
  );
}
