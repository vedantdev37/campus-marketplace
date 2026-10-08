import Link from "next/link";

/**
 * A conversation that does not exist, was removed, or is not yours.
 *
 * Those three cases get one page on purpose. RLS returns nothing for a
 * conversation between two other people, exactly as it does for an id that was
 * never used - so this page cannot be used to find out which ids are real.
 * The usual honest reason is the second: deleting a listing deletes its chats.
 */
export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col bg-canvas text-ink">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="title-card text-[48px] md:text-[64px]">This chat left the group.</h1>
        <p className="mt-3 text-base text-ink-body">
          The listing it was about may have been removed by its seller, or the link may be wrong.
        </p>

        <Link
          href="/inbox"
          className="mt-8 flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-base font-medium text-on-accent hover:bg-accent-active sm:w-fit"
        >
          Back to inbox
        </Link>
      </main>
    </div>
  );
}
