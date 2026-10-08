import type { Metadata } from "next";
import Link from "next/link";

import { BrowseFilters } from "@/components/listings/browse-filters";
import { LiveListingGrid } from "@/components/listings/live-listing-grid";
import { requireSessionUser } from "@/lib/auth";
import { hasActiveFilters, parseListingFilters, type RawSearchParams } from "@/lib/listing-filters";
import { getPickupSpots, listListings } from "@/lib/listings";
import { EXPLORE_TABS, type ExploreTab } from "@/lib/types/listing";

export const metadata: Metadata = {
  title: "Explore · Nitte Mart",
};

/** What to say, and where to send someone, when a tab has nothing in it. */
const EMPTY: Record<ExploreTab, { title: string; body: string; cta: string; type: string }> = {
  buy: {
    title: "Empty shelves. For now.",
    body: "Nobody has listed anything for sale yet. Go first: it takes about a minute.",
    cta: "Sell something",
    type: "sale",
  },
  rent: {
    title: "Nothing to rent. Yet.",
    body: "Own a drafter you use twice a semester? Someone needs it on the other days.",
    cta: "Rent something out",
    type: "rent",
  },
  free: {
    title: "No freebies today.",
    body: "Clearing out your room? Things given away here go quickly.",
    cta: "Give something away",
    type: "free",
  },
  squad: {
    title: "No squads forming. Start one.",
    body: "Say what you can do, or who you need, and let them find you.",
    cta: "Find teammates",
    type: "team_request",
  },
  found: {
    title: "Nothing found. Good news, probably.",
    body: "Picked something up on campus? Post it so its owner can find it.",
    cta: "Post a found item",
    type: "lost_found",
  },
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // proxy.ts already blocks unauthenticated requests. This is the second layer,
  // so the page stays safe if the matcher is ever narrowed.
  await requireSessionUser();

  const params = await searchParams;
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = EXPLORE_TABS.find((candidate) => candidate.key === requested) ?? EXPLORE_TABS[0];

  const filters = { ...parseListingFilters(params), types: tab.types };

  // Independent queries, so they run concurrently rather than in series.
  const [listings, pickupSpots] = await Promise.all([listListings(filters), getPickupSpots()]);

  const filtered = hasActiveFilters(filters);
  const empty = EMPTY[tab.key];

  // The search carries over when you change tab: looking for "drafter" under
  // Buy and then tapping Rent should still be looking for a drafter.
  const tabHref = (key: string) => {
    const query = new URLSearchParams({ tab: key });

    if (filters.search) {
      query.set("q", filters.search);
    }

    return `/explore?${query}`;
  };

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 bg-canvas px-4 py-6 text-ink md:px-6 md:py-8">
      <h1 className="text-[26px] leading-tight font-semibold">Explore</h1>

      {/* One row that scrolls sideways on a narrow phone: five tabs do not fit
          across 390 px at a size a thumb can hit. */}
      <nav aria-label="Kinds of post" className="mt-4 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2">
          {EXPLORE_TABS.map((candidate) => {
            const isCurrent = candidate.key === tab.key;

            return (
              <li key={candidate.key}>
                <Link
                  href={tabHref(candidate.key)}
                  aria-current={isCurrent ? "page" : undefined}
                  // Current tab: filled, heavier, and marked for assistive
                  // technology. Not a colour change alone.
                  className={[
                    "flex h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap",
                    isCurrent
                      ? "border-ink bg-ink font-bold text-canvas"
                      : "border-control-border font-medium text-ink hover:bg-surface-soft",
                  ].join(" ")}
                >
                  {candidate.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab.key === "found" ? (
        <p className="mt-4 rounded-lg bg-surface-soft px-4 py-3 text-sm text-ink-body">
          Posted by students. This is not the college&rsquo;s official lost and found: for ID
          cards, wallets and phones, check with the security office as well.
        </p>
      ) : null}

      <div className="mt-4">
        <BrowseFilters filters={filters} pickupSpots={pickupSpots} tab={tab.key} />
      </div>

      {/* The cards are h3s; this keeps the outline h1 > h2 > h3 without
          adding a visible heading the page does not need. */}
      <h2 className="sr-only">Results</h2>

      <p className="mt-5 text-sm text-ink-muted" aria-live="polite">
        {listings.length === 0
          ? "No results"
          : `${listings.length} ${listings.length === 1 ? "post" : "posts"}`}
        {filtered ? " matching your search" : ""}
      </p>

      {listings.length === 0 ? (
        // Two different empty states, because they need two different actions:
        // an empty tab means "be the first to post", while an empty search
        // means "loosen it".
        <div className="mt-6 max-w-md">
          {filtered ? (
            <>
              <h2 className="text-[22px] leading-tight font-semibold">
                Nothing found. Can&rsquo;t find dates here either.
              </h2>
              <p className="mt-2 text-base text-ink-body">
                Nothing matches that search. Try fewer words, clear a filter, or look under
                another tab.
              </p>
              <Link
                href={`/explore?tab=${tab.key}`}
                className="mt-6 inline-flex h-12 items-center rounded-lg border border-ink px-6 text-base font-medium text-ink hover:bg-surface-soft"
              >
                Clear search
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-[22px] leading-tight font-semibold">{empty.title}</h2>
              <p className="mt-2 text-base text-ink-body">{empty.body}</p>
              <Link
                href={`/post?type=${empty.type}`}
                className="mt-6 inline-flex h-12 items-center rounded-lg bg-accent px-6 text-base font-medium text-on-accent hover:bg-accent-active"
              >
                {empty.cta}
              </Link>
            </>
          )}
        </div>
      ) : (
        // A Client Component: it subscribes to Realtime so a post that is
        // closed greys out here without a refresh. The posts are still fetched
        // on the server, above, through RLS.
        <LiveListingGrid listings={listings} />
      )}
    </main>
  );
}
