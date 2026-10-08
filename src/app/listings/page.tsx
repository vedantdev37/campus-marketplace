import type { Metadata } from "next";
import Link from "next/link";

import { BrowseFilters } from "@/components/listings/browse-filters";
import { LiveListingGrid } from "@/components/listings/live-listing-grid";
import { requireSessionUser } from "@/lib/auth";
import { hasActiveFilters, parseListingFilters, type RawSearchParams } from "@/lib/listing-filters";
import { getPickupSpots, listListings } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Browse · Nitte Mart",
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // proxy.ts already blocks unauthenticated requests. This is the second layer,
  // so the page stays safe if the matcher is ever narrowed.
  const user = await requireSessionUser();

  const filters = parseListingFilters(await searchParams);

  // Independent queries, so they run concurrently rather than in series.
  const [listings, pickupSpots] = await Promise.all([
    listListings(filters),
    getPickupSpots(),
  ]);

  const filtered = hasActiveFilters(filters);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 bg-canvas px-4 py-6 text-ink md:px-6 md:py-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[26px] leading-tight font-semibold">Browse listings</h1>
        <p className="hidden text-sm text-ink-muted sm:block">Signed in as {user.email}</p>
      </div>

      <div className="mt-5">
        <BrowseFilters filters={filters} pickupSpots={pickupSpots} />
      </div>

      {/* The cards are h3s; this keeps the outline h1 > h2 > h3 without
          adding a visible heading the page does not need. */}
      <h2 className="sr-only">Results</h2>

      <p className="mt-5 text-sm text-ink-muted" aria-live="polite">
        {listings.length === 0
          ? "No results"
          : `${listings.length} ${listings.length === 1 ? "listing" : "listings"}`}
        {filtered ? " matching your filters" : ""}
      </p>

      {listings.length === 0 ? (
        // Two different empty states, because they need two different actions:
        // an unfiltered empty marketplace means "be the first to list
        // something", while an empty filtered view means "loosen your filters".
        // One generic message would be unhelpful in both cases.
        <div className="mt-6 max-w-md">
          {filtered ? (
            <>
              <h2 className="text-[22px] leading-tight font-semibold">
                Nothing found. Can&rsquo;t find dates here either.
              </h2>
              <p className="mt-2 text-base text-ink-body">
                No listing matches that search. Try fewer words, clear a filter, or include
                sold items.
              </p>
              <Link
                href="/listings"
                className="mt-6 inline-flex h-12 items-center rounded-lg border border-ink px-6 text-base font-medium text-ink hover:bg-surface-soft"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-[22px] leading-tight font-semibold">Empty shelves. For now.</h2>
              <p className="mt-2 text-base text-ink-body">
                Nobody has listed anything yet. Go first: it takes about a minute.
              </p>
              <Link
                href="/listings/new"
                className="mt-6 inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-medium text-on-accent hover:bg-accent-active"
              >
                Sell an item
              </Link>
            </>
          )}
        </div>
      ) : (
        // A Client Component: it subscribes to Realtime so a listing marked sold
        // greys out here without a refresh. The listings are still fetched on
        // the server, above, through RLS.
        <LiveListingGrid listings={listings} />
      )}
    </main>
  );
}
