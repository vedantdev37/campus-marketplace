/**
 * Placeholder for the listing form while its page resolves on the server.
 *
 * Shared by the create and edit routes, and shaped like the real form (photo
 * tile, then stacked fields) so the layout does not jump when it swaps in.
 */
export function ListingFormSkeleton() {
  return (
    <div className="flex-1 bg-canvas">
      <main className="mx-auto w-full max-w-2xl px-6 py-8" aria-busy="true">
        <span className="sr-only">Loading the listing form…</span>

        <div className="h-4 w-28 animate-pulse rounded bg-surface-soft" />
        <div className="mt-3 h-8 w-44 animate-pulse rounded-md bg-surface-soft" />

        <div className="mt-6 flex flex-col gap-5">
          <div className="h-24 w-32 animate-pulse rounded-lg bg-surface-soft" />
          <div className="h-11 animate-pulse rounded-lg bg-surface-soft" />
          <div className="h-32 animate-pulse rounded-lg bg-surface-soft" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="h-11 animate-pulse rounded-lg bg-surface-soft" />
            <div className="h-11 animate-pulse rounded-lg bg-surface-soft" />
          </div>
        </div>
      </main>
    </div>
  );
}
