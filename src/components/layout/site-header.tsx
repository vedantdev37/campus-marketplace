import Link from "next/link";

import { UnreadPill } from "@/components/chat/unread";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle, type Theme } from "@/components/layout/theme-toggle";
import type { SessionUser } from "@/lib/auth";

/**
 * The one header, shown on every page.
 *
 * From `md` up it carries the navigation: Explore, Inbox, Me, and Post as the
 * one yellow button. On a phone it is only the wordmark and the theme toggle,
 * because the same destinations are in the tab bar at the bottom of the screen
 * (BottomTabs), where a thumb reaches them.
 *
 * Signed-out visitors get Sign in and Sign up instead; the links a session is
 * needed for are simply not offered, rather than shown and then redirected.
 */
export function SiteHeader({ user, theme }: { user: SessionUser | null; theme: Theme }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-3 px-4 md:h-20 md:px-6">
        <Link
          href="/"
          // A brand name: translation tools should leave it alone.
          translate="no"
          // A text-only wordmark for now; the logo is still to be chosen.
          className="title-card flex h-11 items-center pt-0.5 text-[26px] whitespace-nowrap text-ink md:text-[30px]"
        >
          Nitte Mart
        </Link>

        {user ? (
          <>
            <nav aria-label="Main" className="mx-auto hidden items-center gap-6 md:flex">
              <NavLink href="/explore">Explore</NavLink>
              <NavLink href="/inbox">
                Inbox
                <UnreadPill />
              </NavLink>
              <NavLink href="/me">Me</NavLink>
            </nav>

            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <Link
                href="/post"
                className="hidden h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-active md:flex"
              >
                Post
              </Link>
              <ThemeToggle initial={theme} />
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle initial={theme} />
            <Link
              href="/login"
              className="flex h-11 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap text-ink hover:bg-surface-soft sm:px-4"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold whitespace-nowrap text-on-accent hover:bg-accent-active sm:px-5"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
