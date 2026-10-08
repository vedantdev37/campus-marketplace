import Link from "next/link";

import { DigitRoller } from "@/components/home/digit-roller";
import { HeroSlideshow } from "@/components/home/hero-slideshow";
import { ScanDemo } from "@/components/home/scan-demo";
import { ListingCard } from "@/components/listings/listing-card";
import { RevealObserver } from "@/components/motion/reveal-observer";
import { getSessionUser } from "@/lib/auth";
import { formatCampusDay } from "@/lib/campus-time";
import { getHeroImages } from "@/lib/hero-images";
import { getPublicPickupSpots, getPublicStats, getRecentListings } from "@/lib/listings";
import securityRun from "@/lib/security-run.json";

/**
 * The home page: five scenes, one idea each, read by scrolling.
 *
 *   1. Hero            what this is, and a search box
 *   2. Scan it.        the ISBN scanner
 *   3. Meet on campus. pickup spots and meetup booking
 *   4. Locked to NITTE who can get in, with numbers
 *   5. Fresh drops     what is for sale right now
 *
 * It is a public page, so everything on it comes from sources a signed-out
 * visitor is allowed to read: three narrow database functions (migration
 * 0009) and a file written by the security test script. Every number shown is
 * one of those. If a source cannot be read, its part of the page is left out;
 * nothing is filled in with a made-up value.
 */

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

  const [recent, stats, spots] = await Promise.all([
    getRecentListings(),
    getPublicStats(),
    getPublicPickupSpots(),
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

      {/* --- 1. Hero ---------------------------------------------------- */}
      <section className="relative flex min-h-[calc(100svh-3.5rem)] items-end md:min-h-[calc(100svh-5rem)]">
        <HeroSlideshow images={heroImages} />

        {/* Literal white and yellow, not theme colours: this text sits on a
            darkened photograph in both themes. */}
        <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-24 pb-10 md:px-6 md:pb-16">
          {/* Sized from the viewport width, between a floor and a ceiling, so
              the second line breaks in the same place on every screen instead
              of stranding its last word. */}
          <h1 className="title-card max-w-[11.5em] text-[clamp(44px,8.4vw,116px)] text-white">
            <span className="block">Seniors leave.</span>{" "}
            <span className="block">Their stuff doesn&rsquo;t have to.</span>
          </h1>

          <p className="mt-4 max-w-xl text-base text-white/90 md:text-lg">
            Textbooks, calculators, lab coats and hostel gear, passed on by students at your
            college. No shipping. You meet on campus.
          </p>

          {/* A plain GET form to the browse page, so it works without
              JavaScript. Signed-out visitors are sent to sign in first and
              land on their search afterwards: the proxy keeps the destination. */}
          <form
            action="/listings"
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

      {/* --- 2. Scan it. List it. ---------------------------------------- */}
      <section aria-labelledby="scan-heading" className="border-t border-hairline">
        <div className={`${SCENE} grid items-center gap-10 md:grid-cols-2`}>
          <div data-reveal>
            <p className={KICKER}>Listing takes a minute</p>
            <h2 id="scan-heading" className={`${SCENE_TITLE} mt-3`}>
              Scan it. List it.
            </h2>
            <p className="mt-5 max-w-md text-base text-ink-body md:text-lg">
              Point your camera at the barcode on a textbook. The title, author and cover fill
              themselves in, and buyers see whether your price is a fair one.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/listings/new" className={PRIMARY_LINK}>
                Sell something
              </Link>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <ScanDemo />
          </div>
        </div>
      </section>

      {/* --- 3. Meet on campus. ------------------------------------------ */}
      <section aria-labelledby="meet-heading" className="border-t border-hairline bg-surface-soft">
        <div className={`${SCENE} grid items-center gap-10 md:grid-cols-2`}>
          {/* An illustration of the meetup bar in a chat, not a live control. */}
          <div
            data-reveal
            role="img"
            aria-label="Example: in a chat, a meetup at Central Library on Saturday at 4:30 pm has been agreed."
            className="parallax order-2 mx-auto w-full max-w-md md:order-1"
          >
            <div className="rounded-[14px] border border-hairline bg-canvas p-4">
              <p className="w-fit max-w-[80%] rounded-[14px] bg-surface-soft px-3.5 py-2.5 text-base">
                Is the calculator still available?
              </p>
              <p className="mt-2 ml-auto w-fit max-w-[80%] rounded-[14px] bg-indigo px-3.5 py-2.5 text-base text-white">
                Yes. Library, Saturday?
              </p>
              <div className="mt-3 rounded-[14px] bg-success-surface p-4 text-sm">
                <p className="font-semibold">✓ Meetup: Central Library, Sat, 4:30 pm</p>
                <p className="mt-1 text-ink-body">Agreed in chat. Shown on the listing for you both.</p>
              </div>
            </div>
          </div>

          <div data-reveal className="order-1 md:order-2">
            <p className={KICKER}>No shipping, no strangers</p>
            <h2 id="meet-heading" className={`${SCENE_TITLE} mt-3`}>
              Meet on campus.
            </h2>
            <p className="mt-5 max-w-md text-base text-ink-body md:text-lg">
              Ask the seller a question, then book a time and a place in the same chat. They
              accept, or suggest another. Hand it over between classes.
            </p>

            {spots.length > 0 ? (
              <ul aria-label="Pickup spots" className="mt-6 flex flex-wrap gap-2">
                {spots.map((spot) => (
                  <li
                    key={spot.name}
                    className="rounded-full border border-control-border px-3.5 py-2 text-sm font-medium text-ink"
                  >
                    {spot.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      {/* --- 4. Locked to NITTE. ------------------------------------------ */}
      <section aria-labelledby="locked-heading" className="border-t border-hairline">
        <div className={SCENE}>
          <div data-reveal>
            <p className={KICKER}>Students only</p>
            <h2 id="locked-heading" className={`${SCENE_TITLE} mt-3`}>
              Locked to NITTE.
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

      {/* --- 5. Fresh drops ----------------------------------------------- */}
      {recent.length > 0 ? (
        <section aria-labelledby="drops-heading" className="border-t border-hairline bg-surface-soft">
          <div className={SCENE}>
            <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={KICKER}>On campus right now</p>
                <h2 id="drops-heading" className={`${SCENE_TITLE} mt-3`}>
                  Fresh drops
                </h2>
              </div>
              <Link href="/listings" className="flex min-h-11 items-center text-base font-semibold text-ink underline">
                Browse everything
              </Link>
            </div>

            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {recent.map((listing, index) => (
                <li
                  key={listing.id}
                  data-reveal
                  className="flex flex-col"
                  // Cards arrive one after another across a row.
                  style={{ ["--reveal-delay" as string]: `${(index % 4) * 90}ms` }}
                >
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ul>

            {user ? null : (
              <div data-reveal className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className={PRIMARY_LINK}>
                  Create an account
                </Link>
                <Link href="/login" className={SECONDARY_LINK}>
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </section>
      ) : null}

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
