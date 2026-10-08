import Link from "next/link";

import { DigitRoller } from "@/components/home/digit-roller";
import { HeroSlideshow } from "@/components/home/hero-slideshow";
import { ListingCard, TypeBadge } from "@/components/listings/listing-card";
import { RevealObserver } from "@/components/motion/reveal-observer";
import { getSessionUser } from "@/lib/auth";
import { formatCampusDay } from "@/lib/campus-time";
import { getHeroImages } from "@/lib/hero-images";
import { linesFor } from "@/lib/i18n";
import { readLanguage } from "@/lib/language";
import { getHomeSections, getPublicStats, getRecentListings } from "@/lib/listings";
import securityRun from "@/lib/security-run.json";
import { getSavedIds } from "@/lib/wishlist";
import { LISTING_TYPES, type Listing } from "@/lib/types/listing";

/**
 * The home page, read by scrolling:
 *
 *   hero and search
 *   six tiles: the things you can post
 *   Fresh drops, Rent it, Free this week, Squad up, Lost & Found
 *   Locked to NITTE: who can get in, with numbers
 *   end credits
 *
 * It is a public page, so everything on it comes from sources a signed-out
 * visitor is allowed to read: narrow database functions (migrations 0009 and
 * 0010) that return card fields and counts, and a file written by the security
 * test script. Every number shown is one of those. If a source cannot be read,
 * or a section has nothing in it, that part of the page is left out; nothing
 * is filled in with a made-up value.
 */

const ofType = (posts: Listing[], ...types: Listing["type"][]) =>
  posts.filter((post) => types.includes(post.type));

/**
 * The listing sections, in order. `pick` chooses a section's posts from the
 * two lists the page loads: recent sales, and the newest of everything else.
 */
const SECTIONS: {
  tab: "buy" | "rent" | "free" | "squad" | "found";
  kicker: string;
  body?: string;
  pick: (sales: Listing[], others: Listing[]) => Listing[];
}[] = [
  {
    tab: "buy",
    kicker: "On campus right now",
    // Three for sale and the most recently sold one, so the row shows what
    // "sold" looks like without being mostly sold things.
    pick: (sales) => [
      ...sales.filter((post) => post.status === "available").slice(0, 3),
      ...sales.filter((post) => post.status === "sold").slice(0, 1),
    ],
  },
  {
    tab: "rent",
    kicker: "Use it, return it",
    body: "Need a drafter for one ED class? Don’t buy it. Rent it.",
    pick: (_sales, others) => ofType(others, "rent"),
  },
  {
    tab: "free",
    kicker: "No money involved",
    pick: (_sales, others) => ofType(others, "free"),
  },
  {
    tab: "squad",
    kicker: "Skills and teammates",
    body: "Hackathon on Saturday and no backend dev? Someone here is looking for you too.",
    pick: (_sales, others) => ofType(others, "team_request", "skill_offer"),
  },
  {
    tab: "found",
    kicker: "Posted by students, not the official desk",
    pick: (_sales, others) => ofType(others, "lost_found"),
  },
];

const SCENE = "mx-auto w-full max-w-[1280px] px-4 py-16 md:px-6 md:py-28";
const SCENE_TITLE = "title-card text-[44px] text-ink md:text-[88px]";
const KICKER = "text-sm font-semibold tracking-[0.14em] text-indigo-text uppercase";

const PRIMARY_LINK =
  "flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-base font-semibold text-on-accent hover:bg-accent-active";
const SECONDARY_LINK =
  "flex h-12 items-center justify-center rounded-lg border border-ink px-6 text-base font-medium text-ink hover:bg-surface-soft";

export default async function Home() {
  const user = await getSessionUser();
  const heroImages = getHeroImages();
  const lines = linesFor(await readLanguage());

  const [recent, others, stats, savedIds] = await Promise.all([
    getRecentListings(),
    getHomeSections(),
    getPublicStats(),
    // A signed-out visitor has no saved list and sees no hearts.
    user ? getSavedIds(user.id) : null,
  ]);

  const testsAllPassed = securityRun.failed === 0 && securityRun.passed > 0;

  const counters = [
    stats ? { value: stats.students, label: "students signed up" } : null,
    stats ? { value: stats.listings_live, label: "listings live" } : null,
    stats ? { value: stats.items_sold, label: "items sold" } : null,
    stats ? { value: stats.meetups_agreed, label: "meetups agreed" } : null,
  ].filter((counter): counter is { value: number; label: string } => counter !== null);

  return (
    <main className="flex flex-1 flex-col bg-canvas text-ink">
      <RevealObserver />

      {/* --- Hero ------------------------------------------------------- */}
      <section className="relative flex min-h-[70svh] items-end">
        <HeroSlideshow images={heroImages} />

        {/* Literal white and yellow, not theme colours: this text sits on a
            darkened photograph in both themes. */}
        <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-24 pb-10 md:px-6 md:pb-16">
          {/* Sized from the viewport width, between a floor and a ceiling, so
              the second line breaks in the same place on every screen instead
              of stranding its last word. */}
          <h1 className="title-card max-w-[11.5em] text-[clamp(44px,8.4vw,116px)] text-white">
            <span className="block">{lines.heroLine1}</span>{" "}
            <span className="block">{lines.heroLine2}</span>
          </h1>

          <p className="mt-4 max-w-xl text-base text-white/90 md:text-lg">
            {lines.heroBody}
          </p>

          {/* A plain GET form to the browse page, so it works without
              JavaScript. Signed-out visitors are sent to sign in first and
              land on their search afterwards: the proxy keeps the destination. */}
          <form
            action="/explore"
            role="search"
            // The input inside has no outline of its own, so the pill as a
            // whole shows focus instead - one ring around the compound control.
            className="mt-6 flex h-14 w-full max-w-xl items-center rounded-full bg-white pr-1 pl-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white"
          >
            <label htmlFor="home-search" className="sr-only">
              Search listings
            </label>
            <input
              id="home-search"
              type="search"
              name="q"
              placeholder="Search books, course codes…"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-base text-[#12111c] placeholder:text-[#625f73] focus-visible:outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#ffd60a] text-[#0b0b12] hover:bg-[#e6bf00]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          </form>

          {user ? null : (
            // Up here, not in the footer: someone assessing the project needs
            // to know how to get in before they scroll through five scenes.
            <p className="mt-2 max-w-xl text-sm text-white/90">
              Reviewing this project?{" "}
              {/* inline-flex keeps it in the sentence while giving it a
                  full-height tap target. */}
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center font-semibold text-white underline"
              >
                Sign up with any @reviewer.test email
              </Link>
              . No inbox needed.
            </p>
          )}
        </div>
      </section>

      {/* --- Quick tiles: the six things you can post ---------------------- */}
      <section aria-labelledby="tiles-heading" className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6 md:py-14">
          <h2 id="tiles-heading" className="sr-only">
            Post something
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {LISTING_TYPES.map((type) => (
              <li key={type}>
                <Link
                  href={`/post?type=${type}`}
                  className="flex min-h-24 flex-col items-start gap-2 rounded-[14px] border border-control-border p-3.5 hover:bg-surface-soft"
                >
                  <TypeBadge type={type} />
                  <span className="text-base leading-tight font-bold">{lines.post[type]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --- The sections: at most four posts each, then "See all" --------- */}
      {SECTIONS.map((section, index) => {
        const posts = section.pick(recent, others).slice(0, 4);

        // A section with nothing in it is left out. An empty band with a
        // headline over it would only advertise that nobody is here yet.
        if (posts.length === 0) {
          return null;
        }

        return (
          <section
            key={section.tab}
            aria-labelledby={`section-${section.tab}`}
            className={`border-t border-hairline ${index % 2 === 0 ? "bg-surface-soft" : ""}`}
          >
            <div className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-6 md:py-20">
              <div data-reveal className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="max-w-2xl">
                  <p className={KICKER}>{section.kicker}</p>
                  <h2 id={`section-${section.tab}`} className="title-card mt-3 text-[40px] text-ink md:text-[64px]">
                    {lines.section[section.tab]}
                  </h2>
                  {section.body ? (
                    <p className="mt-3 text-base text-ink-body md:text-lg">{section.body}</p>
                  ) : null}
                </div>
                <Link
                  href={`/explore?tab=${section.tab}`}
                  className="flex min-h-11 items-center text-base font-semibold text-ink underline"
                >
                  {lines.seeAll}
                </Link>
              </div>

              <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
                {posts.map((listing, position) => (
                  <li
                    key={listing.id}
                    data-reveal
                    className="flex flex-col"
                    // Cards arrive one after another across a row.
                    style={{ ["--reveal-delay" as string]: `${(position % 4) * 90}ms` }}
                  >
                    <ListingCard listing={listing} saved={savedIds ? savedIds.has(listing.id) : undefined} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}

      {/* --- Locked to NITTE. --------------------------------------------- */}
      <section aria-labelledby="locked-heading" className="border-t border-hairline">
        <div className={SCENE}>
          <div data-reveal>
            <p className={KICKER}>Students only</p>
            <h2 id="locked-heading" className={`${SCENE_TITLE} mt-3`}>
              {lines.locked}
            </h2>
            <p className="mt-5 max-w-2xl text-base text-ink-body md:text-lg">
              You need a campus email to sign up, and it is the database that checks, not just
              this website. Every rule about who can see and change what has a test that tries
              to break it.
            </p>
          </div>

          {/* Each figure is read when this page is requested. They are small
              because the project is new; they are not rounded up. */}
          <dl data-reveal className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-5">
            {counters.map((counter) => (
              <div key={counter.label} className="flex flex-col-reverse gap-2">
                <dt className="text-sm text-ink-muted">{counter.label}</dt>
                <dd className="title-card text-[56px] text-ink md:text-[72px]">
                  <DigitRoller value={counter.value} />
                </dd>
              </div>
            ))}

            <div className="col-span-2 flex flex-col-reverse gap-2 md:col-span-1">
              <dt className="text-sm text-ink-muted">
                security tests passed
                <span className="block">last run {formatCampusDay(securityRun.ranAt)}</span>
              </dt>
              <dd className="title-card text-[56px] text-price md:text-[72px]">
                <DigitRoller value={securityRun.passed} />
                <span className="text-ink-muted">/{securityRun.total}</span>
              </dd>
            </div>
          </dl>

          <div data-reveal className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/security" className={SECONDARY_LINK}>
              Read the receipts
            </Link>
            <p className="text-sm text-ink-muted">
              {testsAllPassed
                ? "Counted live from the database. Tests are run against it, not a copy."
                : "The last test run did not fully pass. The receipts page has the details."}
            </p>
          </div>
        </div>
      </section>

      {user ? null : (
        <section aria-label="Join" className="border-t border-hairline">
          <div data-reveal className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-10 sm:flex-row md:px-6">
            <Link href="/signup" className={PRIMARY_LINK}>
              Create an account
            </Link>
            <Link href="/login" className={SECONDARY_LINK}>
              Sign in
            </Link>
          </div>
        </section>
      )}

      {/* --- End credits -------------------------------------------------- */}
      <section aria-label="Credits" className="border-t border-hairline">
        <div data-reveal className="mx-auto w-full max-w-[1280px] px-4 py-16 text-center md:px-6 md:py-24">
          <p className="title-card text-[40px] text-ink md:text-[64px]">Directed by Vedant Sharma.</p>

          <dl className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-right text-ink-muted">Written and built by</dt>
            <dd className="text-left font-medium">Vedant Sharma</dd>
            <dt className="text-right text-ink-muted">Produced for</dt>
            <dd className="text-left font-medium">GDG NMIT, Round 2</dd>
            <dt className="text-right text-ink-muted">Starring</dt>
            <dd className="text-left font-medium">Your seniors&rsquo; old textbooks</dd>
            <dt className="text-right text-ink-muted">Stunts</dt>
            <dd className="text-left font-medium">Postgres Row Level Security</dd>
          </dl>
        </div>
      </section>
    </main>
  );
}
