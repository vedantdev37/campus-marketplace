"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Must be a Client Component: it receives a `reset` callback and re-renders in
 * the browser, which a Server Component cannot do.
 *
 * Note that `error.message` is deliberately not displayed. In production Next.js
 * replaces it with a generic string anyway, but relying on that would be
 * careless - a thrown database error can carry table names or query fragments,
 * and this boundary catches those too.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates this screen with the full server-side stack trace,
    // which is the only place the real message belongs.
    console.error("Unhandled route error", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          That is on us, not you. Try again — if it keeps happening, reload the page.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Try again
        </button>

        {/* A plain link, not next/link: if the error came from the router or a
            shared layout, a full page load is the more reliable way out. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/listings"
          className="mt-3 block w-full rounded-lg border border-border px-4 py-2.5 text-base font-medium transition-colors hover:bg-surface-muted"
        >
          Back to browse
        </a>

        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-muted">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
