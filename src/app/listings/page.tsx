import type { Metadata } from "next";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrowseFilters } from "@/components/listings/browse-filters";
import { ListingCard } from "@/components/listings/listing-card";
import { requireSessionUser } from "@/lib/auth";
import { hasActiveFilters, parseListingFilters, type RawSearchParams } from "@/lib/listing-filters";
import { getPickupSpots, listListings } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Browse · Campus Marketplace",
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
          <p className="mt-0.5 text-xs text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/listings/mine"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
          >
            My listings
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div className="mt-5">
        <BrowseFilters filters={filters} pickupSpots={pickupSpots} />
      </div>

      <p className="mt-5 text-sm text-muted" aria-live="polite">
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
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          {filtered ? (
            <>
              <p className="text-sm font-medium">Nothing matches those filters</p>
              <p className="mt-1 text-sm text-muted">
                Try a broader search, or include sold items.
              </p>
              <Link
                href="/listings"
                className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Nothing listed yet</p>
              <p className="mt-1 text-sm text-muted">
                The marketplace is empty. Be the first to list something.
              </p>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {listings.map((listing) => (
            <li key={listing.id} className="contents">
              <ListingCard listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
