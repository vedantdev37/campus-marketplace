import type { Metadata } from "next";
import Link from "next/link";

import { ListingCard } from "@/components/listings/listing-card";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
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
    <main className="mx-auto w-full max-w-[1280px] flex-1 bg-canvas px-4 py-6 text-ink md:px-6 md:py-8">
      <ListingLiveRefresh />

      <h1 className="text-[26px] leading-tight font-semibold">My listings</h1>

      {listings.length === 0 ? (
        <div className="mt-6 max-w-md">
          <h2 className="text-[22px] leading-tight font-semibold">You have not listed anything yet</h2>
          <p className="mt-2 text-base text-ink-body">
            Anything you list will appear here, sold items included.
          </p>
          <Link
            href="/listings/new"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-brand-fill px-6 text-base font-medium text-white hover:bg-brand-active"
          >
            Sell your first item
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-ink">
              Available ({available.length})
            </h2>

            {available.length === 0 ? (
              <p className="mt-2 text-base text-ink-body">
                Everything you listed has sold.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
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
              <h2 className="text-lg font-semibold text-ink">Sold ({sold.length})</h2>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
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
