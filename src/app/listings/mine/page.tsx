import type { Metadata } from "next";
import Link from "next/link";

import { MessagesLiveRefresh } from "@/components/chat/messages-live-refresh";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { requireSessionUser } from "@/lib/auth";
import { getInbox } from "@/lib/chat";
import { getMyListings } from "@/lib/listings";
import type { Listing } from "@/lib/types/listing";

export const metadata: Metadata = {
  title: "My listings · Nitte Mart",
};

export default async function MyListingsPage() {
  const user = await requireSessionUser();
  const [listings, inbox] = await Promise.all([getMyListings(user.id), getInbox()]);

  // Conversations where I am the seller, counted per listing.
  const chats = new Map<string, { count: number; unread: number }>();

  for (const row of inbox) {
    if (row.i_am_seller) {
      const entry = chats.get(row.listing_id) ?? { count: 0, unread: 0 };
      entry.count += 1;
      entry.unread += row.unread_count;
      chats.set(row.listing_id, entry);
    }
  }

  // Unlike browse, sold listings stay visible here: a seller needs their own
  // history, which is the opposite of what a buyer's view wants.
  const available = listings.filter((listing) => listing.status === "available");
  const sold = listings.filter((listing) => listing.status === "sold");

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 bg-canvas px-4 py-6 text-ink md:px-6 md:py-8">
      <ListingLiveRefresh />
      <MessagesLiveRefresh />

      <h1 className="text-[26px] leading-tight font-semibold">My listings</h1>

      {listings.length === 0 ? (
        <div className="mt-6 max-w-md">
          <h2 className="text-[22px] leading-tight font-semibold">
            Nothing listed yet. That drafter under your bed won&rsquo;t sell itself.
          </h2>
          <p className="mt-2 text-base text-ink-body">
            Anything you list appears here, sold items included.
          </p>
          <Link
            href="/listings/new"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-medium text-on-accent hover:bg-accent-active"
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
                  <ListingWithChats key={listing.id} listing={listing} chats={chats.get(listing.id)} />
                ))}
              </ul>
            )}
          </section>

          {sold.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-ink">Sold ({sold.length})</h2>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
                {sold.map((listing) => (
                  <ListingWithChats key={listing.id} listing={listing} chats={chats.get(listing.id)} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

/**
 * A card, and under it a link to the conversations about that listing.
 *
 * The link is a sibling of the card and not inside it: the whole card is
 * already one link, and a link cannot contain another.
 */
function ListingWithChats({
  listing,
  chats,
}: {
  listing: Listing;
  chats?: { count: number; unread: number };
}) {
  return (
    <li className="flex flex-col">
      <ListingCard listing={listing} />

      {chats ? (
        <Link
          href={`/inbox?listing=${listing.id}`}
          className="mt-1 flex min-h-11 items-center text-sm font-semibold text-ink underline"
        >
          {chats.count === 1 ? "1 chat" : `${chats.count} chats`}
          {chats.unread > 0 ? ` · ${chats.unread} unread` : ""}
        </Link>
      ) : null}
    </li>
  );
}
