"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header link that knows whether it is the current page.
 *
 * The only part of the header that has to run in the browser: the current path
 * is not available to a Server Component in a layout, because layouts do not
 * re-render on navigation. `aria-current` tells assistive technology which page
 * this is; the underline shows the same thing visually.
 */
export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  /** Match the path exactly, rather than as a prefix. */
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCurrent = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={[
        "flex h-11 items-center border-b-2 px-1 text-base font-semibold",
        isCurrent ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
