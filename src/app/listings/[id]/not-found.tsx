import Link from "next/link";

/**
 * A listing that does not exist - or no longer does.
 *
 * Separate from the site-wide not-found page because the likely reason is
 * different and worth saying: on a marketplace, a missing listing has usually
 * been removed by its seller, not mistyped. This is also what a buyer is left
 * looking at if a listing is deleted while they have it open, since the page
 * re-fetches on that change.
 */
export default function ListingNotFound() {
  return (
    <div className="flex flex-1 flex-col bg-canvas text-ink">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-[28px] leading-[1.25] font-bold">This listing is gone</h1>
        <p className="mt-3 text-base text-ink-body">
          It may have been removed by the seller, or the link may be wrong.
        </p>

        <Link
          href="/listings"
          className="mt-8 flex h-12 items-center justify-center rounded-lg bg-brand px-6 text-base font-medium text-white hover:bg-brand-active sm:w-fit"
        >
          Browse other listings
        </Link>
      </main>
    </div>
  );
}
