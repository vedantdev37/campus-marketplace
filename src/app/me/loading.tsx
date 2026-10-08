import { LoadingTip } from "@/components/ui/loading-tip";

/** Shown while Me resolves: the profile row, then a few cards. */
export default function MeLoading() {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-6 md:py-8" aria-busy="true">
      <span className="sr-only">Loading your posts…</span>

      <div className="flex items-center gap-4">
        <div className="size-[72px] rounded-full bg-surface-soft motion-safe:animate-pulse" />
        <div className="flex flex-col gap-2">
          <div className="h-6 w-40 rounded bg-surface-soft motion-safe:animate-pulse" />
          <div className="h-4 w-56 rounded bg-surface-soft motion-safe:animate-pulse" />
        </div>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="aspect-square rounded-[4px] bg-surface-soft motion-safe:animate-pulse" />
        ))}
      </ul>

      <LoadingTip tip={3} />
    </main>
  );
}
