/** Shown while a conversation resolves: the listing strip, then a few bubbles. */
export default function ConversationLoading() {
  return (
    <main className="flex flex-1 flex-col" aria-busy="true">
      <span className="sr-only">Loading conversation…</span>

      <div className="border-b border-hairline px-4 py-3 md:px-6">
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-3">
          <div className="size-12 rounded-[14px] bg-surface-soft motion-safe:animate-pulse" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 rounded bg-surface-soft motion-safe:animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-surface-soft motion-safe:animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-3 px-4 py-4 md:px-6">
        <div className="h-10 w-2/3 rounded-[14px] bg-surface-soft motion-safe:animate-pulse" />
        <div className="h-10 w-1/2 self-end rounded-[14px] bg-surface-soft motion-safe:animate-pulse" />
        <div className="h-10 w-3/5 rounded-[14px] bg-surface-soft motion-safe:animate-pulse" />
      </div>
    </main>
  );
}
