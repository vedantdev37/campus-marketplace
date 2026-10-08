/**
 * Shown while the browse page is still resolving on the server.
 *
 * Shaped like the real page - header, search bar, then a grid of 4:3 cards at
 * the same column counts - so the layout does not jump when content swaps in.
 * The previous version was a single narrow block that matched none of the three
 * pages it was shown for.
 *
 * `motion-safe:` so the pulse is skipped for anyone who has asked their system
 * to reduce motion.
 */
export default function ListingsLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6" aria-busy="true">
      <span className="sr-only">Loading listings…</span>
      <p aria-hidden="true" className="mb-4 text-sm text-ink-muted">
        Checking under every hostel bed…
      </p>

      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-28 rounded-md bg-surface-muted motion-safe:animate-pulse" />
        <div className="h-9 w-48 rounded-lg bg-surface-muted motion-safe:animate-pulse" />
      </div>

      <div className="mt-5 h-11 rounded-lg bg-surface-muted motion-safe:animate-pulse" />
      <div className="mt-3 h-11 rounded-lg bg-surface-muted motion-safe:animate-pulse" />

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="overflow-hidden rounded-xl border border-border">
            <div className="aspect-4/3 bg-surface-muted motion-safe:animate-pulse" />
            <div className="flex flex-col gap-2 p-3">
              <div className="h-4 w-4/5 rounded bg-surface-muted motion-safe:animate-pulse" />
              <div className="h-5 w-1/3 rounded bg-surface-muted motion-safe:animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
