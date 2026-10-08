import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { MessagesLiveRefresh } from "@/components/chat/messages-live-refresh";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { requireSessionUser } from "@/lib/auth";
import { getInbox } from "@/lib/chat";
import { getMyListings } from "@/lib/listings";
import { readTheme } from "@/lib/theme";
import { isListingType, LISTING_TYPES, TYPE_INFO, type Listing } from "@/lib/types/listing";

export const metadata: Metadata = {
  title: "Me · Nitte Mart",
};

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const user = await requireSessionUser();
  const { type } = await searchParams;
  const shownType = isListingType(type) ? type : null;

  const [listings, inbox, theme] = await Promise.all([
    getMyListings(user.id),
    getInbox(),
    readTheme(),
  ]);

  // Conversations where I am the one who posted, counted per post.
  const chats = new Map<string, { count: number; unread: number }>();

  for (const row of inbox) {
    if (row.i_am_seller) {
      const entry = chats.get(row.listing_id) ?? { count: 0, unread: 0 };
      entry.count += 1;
      entry.unread += row.unread_count;
      chats.set(row.listing_id, entry);
    }
  }

  // Only the kinds I have actually posted get a tab.
  const usedTypes = LISTING_TYPES.filter((value) => listings.some((listing) => listing.type === value));
  const shown = shownType ? listings.filter((listing) => listing.type === shownType) : listings;

  // Finished posts stay visible here: you need your own history.
  const open = shown.filter((listing) => listing.status === "available");
  const closed = shown.filter((listing) => listing.status === "sold");

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 bg-canvas px-4 py-6 text-ink md:px-6 md:py-8">
      <ListingLiveRefresh />
      <MessagesLiveRefresh />

      <h1 className="text-[26px] leading-tight font-semibold">Me</h1>
      <p className="mt-1 text-sm text-ink-muted">Signed in as {user.email}</p>

      <section aria-labelledby="my-posts" className="mt-8">
        <h2 id="my-posts" className="text-lg font-semibold">
          My posts
        </h2>

        {listings.length === 0 ? (
          <div className="mt-4 max-w-md">
            <p className="text-[22px] leading-tight font-semibold">
              Nothing listed yet. That drafter under your bed won&rsquo;t sell itself.
            </p>
            <p className="mt-2 text-base text-ink-body">
              Anything you post appears here, finished ones included.
            </p>
            <Link
              href="/post"
              className="mt-6 inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-medium text-on-accent hover:bg-accent-active"
            >
              Post something
            </Link>
          </div>
        ) : (
          <>
            {usedTypes.length > 1 ? (
              <nav aria-label="Filter my posts" className="mt-3 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                <ul className="flex w-max gap-2">
                  {[null, ...usedTypes].map((value) => {
                    const isCurrent = value === shownType;

                    return (
                      <li key={value ?? "all"}>
                        <Link
                          href={value ? `/me?type=${value}` : "/me"}
                          aria-current={isCurrent ? "page" : undefined}
                          className={[
                            "flex h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap",
                            isCurrent
                              ? "border-ink bg-ink font-bold text-canvas"
                              : "border-control-border font-medium text-ink hover:bg-surface-soft",
                          ].join(" ")}
                        >
                          {value ? TYPE_INFO[value].badge : "All"}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : null}

            <h3 className="mt-6 text-base font-semibold">Open ({open.length})</h3>
            {open.length === 0 ? (
              <p className="mt-2 text-base text-ink-body">Nothing open right now.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
                {open.map((listing) => (
                  <PostWithChats key={listing.id} listing={listing} chats={chats.get(listing.id)} />
                ))}
              </ul>
            )}

            {closed.length > 0 ? (
              <>
                <h3 className="mt-8 text-base font-semibold">Finished ({closed.length})</h3>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
                  {closed.map((listing) => (
                    <PostWithChats key={listing.id} listing={listing} chats={chats.get(listing.id)} />
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="settings" className="mt-12 max-w-md">
        <h2 id="settings" className="text-lg font-semibold">
          Settings
        </h2>

        <div className="mt-3 flex flex-col rounded-[14px] border border-hairline p-2">
          <ThemeToggle initial={theme} variant="row" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex h-11 w-full items-center rounded-lg px-3 text-left text-base font-medium text-ink hover:bg-surface-soft"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

/**
 * A card, and under it a link to the conversations about that post.
 *
 * The link is a sibling of the card and not inside it: the whole card is
 * already one link, and a link cannot contain another.
 */
function PostWithChats({
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
