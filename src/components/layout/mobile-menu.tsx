"use client";

import { usePathname } from "next/navigation";

import { useUnreadCount } from "@/components/chat/unread";

/**
 * The phone navigation menu.
 *
 * A native <details> element, so it opens and closes with no JavaScript and is
 * keyboard-operable for free. The one thing a native <details> does not do is
 * close when you follow a link inside it: the header lives in the root layout,
 * which is not re-rendered on navigation, so the menu would stay open over the
 * page you had just navigated to.
 *
 * Keying it by the current path fixes that without any open/closed state of our
 * own: when the path changes React replaces the element, and a fresh <details>
 * starts closed.
 */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const unread = useUnreadCount();

  return (
    <details key={pathname} className="group relative md:hidden">
      <summary
        // The Inbox link is inside the closed menu, so the button itself has to
        // say there is something waiting: a dot for the eye, words for a
        // screen reader.
        aria-label={unread > 0 ? `Menu, ${unread} unread` : "Menu"}
        className="relative flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-control-border text-ink hover:bg-surface-soft [&::-webkit-details-marker]:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>

        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 size-3 rounded-full border-2 border-canvas bg-ink"
          />
        ) : null}
      </summary>

      <div className="absolute right-0 mt-2 flex w-56 flex-col rounded-[14px] border border-hairline bg-canvas p-2 shadow-float">
        {children}
      </div>
    </details>
  );
}
