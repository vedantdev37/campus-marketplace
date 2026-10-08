/** Shown while My Listings resolves: a header, then one section of cards. */
export default function MyListingsLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6" aria-busy="true">
      <span className="sr-only">Loading your listings…</span>

      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-36 rounded-md bg-surface-muted motion-safe:animate-pulse" />
        <div className="h-9 w-40 rounded-lg bg-surface-muted motion-safe:animate-pulse" />
      </div>

      <div className="mt-6 h-4 w-24 rounded bg-surface-muted motion-safe:animate-pulse" />

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
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
