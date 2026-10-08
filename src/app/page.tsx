import Link from "next/link";

import { HeroSlideshow } from "@/components/home/hero-slideshow";
import { ListingCard } from "@/components/listings/listing-card";
import { getSessionUser } from "@/lib/auth";
import { getHeroImages } from "@/lib/hero-images";
import { getRecentListings } from "@/lib/listings";

const TRUST_SIGNALS = [
  {
    title: "NMIT students only",
    body: "Sign-up needs an @nmit.ac.in address, checked by the database. Everyone you deal with is on campus.",
    icon: "M12 3l8 4v5c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V7l8-4zm-3.5 9l2.5 2.5 4.5-5",
  },
  {
    title: "Meet at a campus pickup spot",
    body: "Every listing names a handover point - the library, the main gate, the food court. No shipping, no strangers.",
    icon: "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zm0-8.500a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  },
  {
    title: "Scan a book to list it",
    body: "Point your camera at the barcode. Title, author and cover fill in, and buyers see whether your price is fair.",
    icon: "M4 6v12M7 6v12M10 6v12M13 6v12M16 6v12M20 6v12M3 4h18v16H3z",
  },
] as const;

export default async function Home() {
  const user = await getSessionUser();
  const heroImages = getHeroImages();
  const recent = await getRecentListings(Boolean(user));

  return (
    <main className="flex flex-1 flex-col bg-canvas text-ink">
      {/* --- Hero ------------------------------------------------------- */}
      <section className="relative flex h-[420px] items-end md:h-[520px]">
        <HeroSlideshow images={heroImages} />

        {/* Literal white, not a theme colour: this text sits on a photograph
            under a dark gradient in both light and dark mode. */}
        <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-16 md:px-6 md:pb-20">
          <h1 className="max-w-xl text-[32px] leading-[1.15] font-bold text-white md:text-[48px]">
            Buy and sell within NMIT
          </h1>
          <p className="mt-3 max-w-lg text-base text-white/90 md:text-lg">
            Textbooks, calculators, lab coats and hostel essentials from students on your
            campus - handed over in person.
          </p>
        </div>
      </section>

      {/* --- Search ------------------------------------------------------
          A plain GET form to the browse page, so it works without JavaScript.
          Signed-out visitors are sent to sign in first and land on their
          search afterwards, because the proxy preserves the destination. */}
      <div className="relative z-10 mx-auto -mt-7 w-full max-w-2xl px-4">
        <form
          action="/listings"
          role="search"
          // The input inside has no outline of its own, so the pill as a whole
          // shows focus instead - one ring around the compound control.
          className="flex h-14 items-center rounded-full border border-hairline bg-canvas pr-1 pl-5 shadow-float focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink"
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
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-fill text-white hover:bg-brand-active"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        </form>
      </div>

      {/* --- Recent listings -------------------------------------------- */}
      {recent.length > 0 ? (
        <section aria-labelledby="recent-heading" className="mx-auto w-full max-w-[1280px] px-4 pt-12 md:px-6 md:pt-16">
          <div className="flex items-end justify-between gap-4">
            <h2 id="recent-heading" className="text-[22px] leading-tight font-semibold md:text-[26px]">
              Just listed on campus
            </h2>
            <Link href="/listings" className="shrink-0 text-base font-semibold text-ink underline">
              View all
            </Link>
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {recent.map((listing) => (
              <li key={listing.id} className="contents">
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* --- Trust signals ----------------------------------------------- */}
      <section aria-labelledby="trust-heading" className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-6 md:py-16">
        <h2 id="trust-heading" className="text-[22px] leading-tight font-semibold md:text-[26px]">
          Built for this campus
        </h2>

        <ul className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
          {TRUST_SIGNALS.map((signal) => (
            <li key={signal.title}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 text-ink" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={signal.icon} />
              </svg>
              <h3 className="mt-3 text-base font-semibold">{signal.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{signal.body}</p>
            </li>
          ))}
        </ul>

        {user ? null : (
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="flex h-12 items-center justify-center rounded-lg bg-brand-fill px-6 text-base font-medium text-white hover:bg-brand-active"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-lg border border-ink px-6 text-base font-medium text-ink hover:bg-surface-soft"
            >
              Sign in
            </Link>
          </div>
        )}
      </section>

      <footer className="mt-auto border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-1 px-4 py-6 text-sm text-ink-muted md:px-6">
          <p>Campus Marketplace - built by an NMIT student for the GDG NMIT full-stack challenge.</p>
          {user ? null : (
            <p>
              Reviewing this project? Sign up with any{" "}
              <span className="font-semibold text-ink">@reviewer.test</span> email - no inbox
              needed.
            </p>
          )}
        </div>
      </footer>
    </main>
  );
}
