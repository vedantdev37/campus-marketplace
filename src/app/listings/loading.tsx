/**
 * Shown while the listings page is still resolving on the server.
 *
 * A `loading.tsx` file wraps the route in a Suspense boundary automatically, so
 * the shell appears immediately instead of the user staring at a blank tab.
 *
 * The skeleton deliberately mirrors the real layout's shape - same heading
 * sizes, same card - so content does not jump when it swaps in.
 */
export default function ListingsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8" aria-busy="true">
      <span className="sr-only">Loading listings…</span>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-32 animate-pulse rounded-md bg-surface-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-muted" />
      </div>

      <div className="mt-8 h-32 animate-pulse rounded-2xl bg-surface-muted" />
    </main>
  );
}
