"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LANGUAGE_LABELS, LANGUAGES, type Language } from "@/lib/i18n";

/** A year. It is a preference, like the theme. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Outside the component: writing a cookie is a side effect on the document. */
function rememberLanguage(language: Language): void {
  document.cookie = `lang=${language}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * English, Hinglish or Kanglish for the headline lines.
 *
 * The choice is a cookie the server reads (`readLanguage`), so the page is
 * rendered in the chosen language and nothing swaps after it loads. Changing
 * it asks the router to re-render the current page on the server.
 *
 * The current choice is marked by `aria-pressed` and a filled button, not by
 * colour alone.
 */
export function LanguageToggle({ initial }: { initial: Language }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initial);

  function choose(next: Language) {
    rememberLanguage(next);
    setLanguage(next);
    router.refresh();
  }

  return (
    <div role="group" aria-label="Language" className="flex flex-wrap gap-1">
      {LANGUAGES.map((value) => {
        const isCurrent = value === language;

        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={isCurrent}
            className={[
              "flex h-11 items-center rounded-full border px-3.5 text-sm",
              isCurrent
                ? "border-ink bg-ink font-bold text-canvas"
                : "border-control-border font-medium text-ink hover:bg-surface-soft",
            ].join(" ")}
          >
            {LANGUAGE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
