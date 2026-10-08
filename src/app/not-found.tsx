import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found · Nitte Mart",
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
        <h1 className="title-card mt-2 text-[48px] md:text-[64px]">This page bunked class.</h1>
        <p className="mt-4 text-base text-ink-body">
          There is nothing at this address. The link may be mistyped, or the page may have been
          removed. Try browsing instead.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/explore"
            className="flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-base font-medium text-on-accent hover:bg-accent-active"
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
