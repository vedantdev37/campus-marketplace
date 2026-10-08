import { LoadingTip } from "@/components/ui/loading-tip";

/** Shown while the Inbox resolves: a heading, then a few conversation rows. */
export default function InboxLoading() {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6 md:px-6 md:py-8" aria-busy="true">
      <span className="sr-only">Loading your inbox…</span>

      <div className="h-8 w-28 rounded-md bg-surface-soft motion-safe:animate-pulse" />

      <ul className="mt-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 border-b border-hairline py-3">
            <div className="size-14 shrink-0 rounded-[14px] bg-surface-soft motion-safe:animate-pulse" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-1/3 rounded bg-surface-soft motion-safe:animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-surface-soft motion-safe:animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-surface-soft motion-safe:animate-pulse" />
            </div>
          </li>
        ))}
      </ul>

      <LoadingTip tip={2} />
    </main>
  );
}
