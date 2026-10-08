"use client";

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

/** A year. The choice is a preference, not a session. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const THEME_EVENT = "themechange";

/** The page can show more than one toggle (header, menu, footer). They all
    read the attribute on <html>, so pressing one updates the others. */
function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Switches between the dark theme (the default) and the light one.
 *
 * The theme is the `data-theme` attribute on <html>. Setting it here changes
 * the page at once; writing the cookie is what makes the server render the
 * same theme on the next request, so there is no flash of the wrong one while
 * the page loads. Nothing about the choice is stored anywhere else.
 *
 * `initial` comes from the server, which read the same cookie - so the
 * button's label is right in the HTML and does not change on hydration.
 */
export function ThemeToggle({
  initial,
  variant = "icon",
}: {
  initial: Theme;
  /** `icon` is a round button; `row` is a full-width menu row with a label. */
  variant?: "icon" | "row";
}) {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => initial);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const icon = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {theme === "dark" ? (
        // Showing a sun: what you will get.
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : (
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      )}
    </svg>
  );

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-medium text-ink hover:bg-surface-soft"
      >
        {icon}
        {next === "light" ? "Light theme" : "Dark theme"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-soft"
    >
      {icon}
    </button>
  );
}
