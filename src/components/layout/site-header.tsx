import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { UnreadPill, UnreadProvider } from "@/components/chat/unread";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle, type Theme } from "@/components/layout/theme-toggle";
import type { SessionUser } from "@/lib/auth";

/**
 * The one header, shown on every page.
 *
 * Before this existed each page built its own: browse and My Listings had
 * different ones, Sign out lived only on browse, and the home and detail pages
 * had none - so the way to sign out depended on which page you happened to be
 * on. One header means navigation is in the same place everywhere.
 *
 * Signed-out visitors get Sign in and Sign up instead; the links a session is
 * needed for are simply not offered, rather than shown and then redirected.
 */
export function SiteHeader({ user, theme }: { user: SessionUser | null; theme: Theme }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-3 px-4 md:h-20 md:px-6">
        <Link
          href={user ? "/listings" : "/"}
          // A brand name: translation tools should leave it alone.
          translate="no"
          // A text-only wordmark for now; the logo is still to be chosen.
          className="title-card flex h-11 items-center pt-0.5 text-[26px] text-ink md:text-[30px]"
        >
          Nitte Mart
        </Link>

        {user ? (
          // Shares one unread count between the desktop link, the phone menu
          // and the menu button.
          <UnreadProvider userId={user.id}>
            {/* Desktop: links sit in the middle of the bar. */}
            <nav aria-label="Main" className="mx-auto hidden items-center gap-6 md:flex">
              <NavLink href="/listings" exact>
                Browse
              </NavLink>
              <NavLink href="/listings/mine">My listings</NavLink>
              <NavLink href="/inbox">
                Inbox
                <UnreadPill />
              </NavLink>
            </nav>

            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <Link
                href="/listings/new"
                className="flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-active"
              >
                Sell
              </Link>

              <div className="hidden md:block">
                <ThemeToggle initial={theme} />
              </div>

              <form action={signOutAction} className="hidden md:block">
                <button
                  type="submit"
                  className="flex h-11 items-center rounded-full px-4 text-sm font-semibold text-ink hover:bg-surface-soft"
                >
                  Sign out
                </button>
              </form>

              {/* Phones: the rest of the navigation folds into a menu. */}
              <MobileMenu>
                <p className="truncate px-3 py-2 text-xs text-ink-muted">{user.email}</p>
                <Link href="/listings" className="flex h-11 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-surface-soft">
                  Browse
                </Link>
                <Link href="/listings/mine" className="flex h-11 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-surface-soft">
                  My listings
                </Link>
                <Link href="/inbox" className="flex h-11 items-center rounded-lg px-3 text-base font-medium text-ink hover:bg-surface-soft">
                  Inbox
                  <UnreadPill />
                </Link>
                <ThemeToggle initial={theme} variant="row" />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex h-11 w-full items-center rounded-lg px-3 text-left text-base font-medium text-ink hover:bg-surface-soft"
                  >
                    Sign out
                  </button>
                </form>
              </MobileMenu>
            </div>
          </UnreadProvider>
        ) : (
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle initial={theme} />
            <Link
              href="/login"
              className="flex h-11 items-center rounded-full px-4 text-sm font-semibold text-ink hover:bg-surface-soft"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-active"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
