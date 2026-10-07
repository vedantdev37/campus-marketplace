import type { Metadata } from "next";
import Link from "next/link";

import { ListingCard } from "@/components/listings/listing-card";
import { requireSessionUser } from "@/lib/auth";
import { getMyListings } from "@/lib/listings";

export const metadata: Metadata = {
  title: "My listings · Campus Marketplace",
};

export default async function MyListingsPage() {
  const user = await requireSessionUser();
  const listings = await getMyListings(user.id);

  // Unlike browse, sold listings stay visible here: a seller needs their own
  // history, which is the opposite of what a buyer's view wants.
  const available = listings.filter((listing) => listing.status === "available");
  const sold = listings.filter((listing) => listing.status === "sold");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
        <Link
          href="/listings"
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
        >
          Browse
        </Link>
      </header>

      {listings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium">You have not listed anything yet</p>
          <p className="mt-1 text-sm text-muted">
            Anything you list will appear here, sold items included.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-sm font-medium text-muted">
              Available ({available.length})
            </h2>

            {available.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
                Everything you listed has sold.
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {available.map((listing) => (
                  <li key={listing.id} className="contents">
                    <ListingCard listing={listing} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {sold.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-medium text-muted">Sold ({sold.length})</h2>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {sold.map((listing) => (
                  <li key={listing.id} className="contents">
                    <ListingCard listing={listing} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
