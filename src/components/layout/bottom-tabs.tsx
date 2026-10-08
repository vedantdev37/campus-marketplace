"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UnreadPill } from "@/components/chat/unread";

const TABS = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/explore", label: "Explore", icon: "M11 4a7 7 0 105.2 11.7L20 19.5M11 4a7 7 0 010 14" },
  { href: "/post", label: "Post", icon: "M12 5v14M5 12h14" },
  { href: "/inbox", label: "Inbox", icon: "M4 5h16v11H9l-5 4z" },
  { href: "/me", label: "Me", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0" },
] as const;

/**
 * The phone navigation: five destinations along the bottom, where a thumb is.
 *
 * Shown to signed-in users below the `md` breakpoint; from there up the same
 * destinations are in the header. It is hidden on a conversation and on a
 * listing with its own action bar (rules in globals.css): those pages already
 * have something pinned to the bottom, and two stacked bars would leave little
 * room for the page.
 *
 * The current tab is marked three ways - a bar above it, a heavier label and
 * `aria-current` - so it does not rely on colour.
 */
export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="bottom-tabs fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-md items-stretch">
        {TABS.map((tab) => {
          const isCurrent =
            tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const isPost = tab.href === "/post";

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isCurrent ? "page" : undefined}
                className={[
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px]",
                  isCurrent ? "font-bold text-ink" : "font-medium text-ink-muted",
                ].join(" ")}
              >
                {isCurrent && !isPost ? (
                  <span aria-hidden="true" className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-ink" />
                ) : null}

                <span
                  className={
                    isPost
                      ? "flex size-9 items-center justify-center rounded-full bg-accent text-on-accent"
                      : "flex size-6 items-center justify-center"
                  }
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isCurrent || isPost ? 2.4 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tab.icon} />
                  </svg>
                </span>

                {isPost ? <span className="sr-only">Post</span> : tab.label}

                {tab.href === "/inbox" ? (
                  <span className="absolute top-1 left-1/2 ml-1">
                    <UnreadPill />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
