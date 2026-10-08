import Link from "next/link";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle, type Theme } from "@/components/layout/theme-toggle";
import type { Language } from "@/lib/i18n";

/**
 * The footer on every page except a conversation, which fills the screen.
 *
 * The disclaimer is here, and not only on the home page, because the name
 * borrows from the college's: wherever someone lands, it should be plain that
 * this is a student's project and not an official service.
 */
export function SiteFooter({ theme, language }: { theme: Theme; language: Language }) {
  return (
    <footer className="site-footer mt-auto border-t border-hairline bg-canvas text-ink">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:px-6">
        <div className="text-sm text-ink-muted">
          <p className="text-ink-body">
            A student project by Vedant Sharma. Not affiliated with NITTE.
          </p>
          <p className="mt-1">
            Built for the GDG NMIT full-stack challenge. Demo photos:{" "}
            <a
              href="https://github.com/vedantdev37/campus-marketplace/blob/main/docs/credits.md"
              className="font-semibold text-ink underline"
            >
              Unsplash
            </a>
            .
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-1 gap-y-2 md:ml-auto md:justify-end">
          <LanguageToggle initial={language} />
          <Link
            href="/commentary"
            className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink underline hover:bg-surface-soft"
          >
            Commentary
          </Link>
          <Link
            href="/security"
            className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink underline hover:bg-surface-soft"
          >
            Security receipts
          </Link>
          <Link
            href="/explore"
            className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink underline hover:bg-surface-soft"
          >
            Browse
          </Link>
          <ThemeToggle initial={theme} />
        </nav>
      </div>
    </footer>
  );
}
