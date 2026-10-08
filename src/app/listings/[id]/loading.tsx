import { LoadingTip } from "@/components/ui/loading-tip";

/**
 * Shown while a listing's detail page resolves.
 *
 * Its own file because the detail page is one tall card with a large photo -
 * inheriting the browse grid skeleton would flash six small cards and then
 * replace them with something of a completely different shape.
 */
export default function ListingDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6" aria-busy="true">
      <span className="sr-only">Loading listing…</span>

      <div className="h-4 w-32 rounded bg-surface-muted motion-safe:animate-pulse" />

      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <div className="aspect-4/3 bg-surface-muted motion-safe:animate-pulse" />
        <div className="flex flex-col gap-3 p-5">
          <div className="h-6 w-3/4 rounded bg-surface-muted motion-safe:animate-pulse" />
          <div className="h-8 w-28 rounded bg-surface-muted motion-safe:animate-pulse" />
          <div className="h-20 rounded bg-surface-muted motion-safe:animate-pulse" />
        </div>
      </div>

      <LoadingTip tip={4} />
    </main>
  );
}
