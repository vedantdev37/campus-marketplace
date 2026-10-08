import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { MessagesLiveRefresh } from "@/components/chat/messages-live-refresh";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { NotificationsToggle } from "@/components/layout/notifications-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { Avatar } from "@/components/profile/avatar";
import { requireSessionUser } from "@/lib/auth";
import { getInbox } from "@/lib/chat";
import { getMyListings } from "@/lib/listings";
import { getProfile, initialsOf } from "@/lib/profiles";
import { readLanguage } from "@/lib/language";
import { readTheme } from "@/lib/theme";
import { getSavedListings } from "@/lib/wishlist";
import { isListingType, LISTING_TYPES, TYPE_INFO, type Listing } from "@/lib/types/listing";

export const metadata: Metadata = {
  title: "Me · Nitte Mart",
};

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; tab?: string | string[] }>;
}) {
  const user = await requireSessionUser();
  const { type, tab } = await searchParams;
  const shownType = isListingType(type) ? type : null;
  const showSaved = tab === "saved";

  const [listings, inbox, theme, profile, savedListings] = await Promise.all([
    getMyListings(user.id),
    getInbox(),
    readTheme(),
    getProfile(user.id),
    getSavedListings(user.id),
  ]);
  const language = await readLanguage();

  const name = profile?.full_name || "You";

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

      <div className="flex items-center gap-4">
        <Avatar name={name} initials={initialsOf(name)} avatarPath={profile?.avatar_path ?? null} size={72} />

        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold break-words">{name}</h1>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{user.email}</p>
        </div>
      </div>

      <section aria-labelledby="my-skills" className="mt-6">
        <h2 id="my-skills" className="text-lg font-semibold">
          My skills
        </h2>

        {profile && profile.skills.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-control-border px-3.5 py-2 text-sm font-medium text-ink"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-base text-ink-body">
            None yet. Add a few and people looking for teammates can find you.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-5">
          <Link href="/me/profile" className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline">
            Edit profile
          </Link>
          <Link href={`/u/${user.id}`} className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline">
            See my public profile
          </Link>
        </div>
      </section>

      {/* Two lists live here: what I posted, and what I saved. */}
      <nav aria-label="My lists" className="mt-8">
        <ul className="flex gap-2">
          {[
            { href: "/me", label: `My posts (${listings.length})`, current: !showSaved },
            { href: "/me?tab=saved", label: `Saved (${savedListings.length})`, current: showSaved },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                className={[
                  "flex h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap",
                  item.current
                    ? "border-ink bg-ink font-bold text-canvas"
                    : "border-control-border font-medium text-ink hover:bg-surface-soft",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {showSaved ? (
        <section aria-labelledby="saved-posts" className="mt-4">
          <h2 id="saved-posts" className="sr-only">
            Saved
          </h2>

          {savedListings.length === 0 ? (
            <div className="mt-2 max-w-md">
              <p className="text-[22px] leading-tight font-semibold">Nothing saved. Window shopping is free.</p>
              <p className="mt-2 text-base text-ink-body">
                Tap the heart on anything you want to come back to. If it sells while you have
                the site open, you will be told.
              </p>
              <Link
                href="/explore"
                className="mt-6 inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-medium text-on-accent hover:bg-accent-active"
              >
                Explore
              </Link>
            </div>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
              {savedListings.map((listing) => (
                <li key={listing.id} className="flex flex-col">
                  <ListingCard listing={listing} saved />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
      <section aria-labelledby="my-posts" className="mt-4">
        <h2 id="my-posts" className="sr-only">
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
      )}

      <section aria-labelledby="settings" className="mt-12 max-w-md">
        <h2 id="settings" className="text-lg font-semibold">
          Settings
        </h2>

        <div className="mt-3 flex flex-col rounded-[14px] border border-hairline p-2">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-ink">Language</p>
            <p className="mb-2 text-sm text-ink-muted">Changes the headline lines only.</p>
            <LanguageToggle initial={language} />
          </div>
          <ThemeToggle initial={theme} variant="row" />
          <NotificationsToggle />
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
