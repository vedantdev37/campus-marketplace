import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found · Campus Marketplace",
};

/**
 * Shown for any URL that matches no route, and whenever a page calls
 * `notFound()` without a closer not-found file of its own.
 *
 * Without this file Next renders its own bare "404" page, which looks like the
 * site broke rather than like an answer.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col bg-canvas text-ink">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium text-ink-muted">404</p>
        <h1 className="mt-1 text-[28px] leading-[1.25] font-bold">We could not find that page</h1>
        <p className="mt-3 text-base text-ink-body">
          The link may be mistyped, or the page may have been removed.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/listings"
            className="flex h-12 items-center justify-center rounded-lg bg-brand px-6 text-base font-medium text-white hover:bg-brand-active"
          >
            Browse listings
          </Link>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-lg border border-ink bg-canvas px-6 text-base font-medium text-ink hover:bg-surface-soft"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
