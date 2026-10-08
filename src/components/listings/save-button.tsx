"use client";

import { useState, useTransition } from "react";

import { setSavedAction } from "@/app/saved/actions";

/**
 * The heart: save a post to come back to, or take it off the list.
 *
 * Saved and not-saved differ in shape (a filled heart or an outline) and in
 * `aria-pressed`, and on the detail page in words too - not only in colour.
 * The change shows at once and is put back if the server refuses it.
 */
export function SaveButton({
  listingId,
  initialSaved,
  variant = "icon",
  className = "",
}: {
  listingId: string;
  initialSaved: boolean;
  /** `icon` sits on a card's photo; `row` is a full-width button with a label. */
  variant?: "icon" | "row";
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next);
    setError(null);

    startTransition(async () => {
      const result = await setSavedAction({ listingId, save: next });
      setSaved(result.saved);
      setError(result.error ?? null);

      // Lets the alert watcher (LiveAlerts) re-read what is saved.
      window.dispatchEvent(new Event("saved:change"));
    });
  }

  const heart = (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill={saved ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
    </svg>
  );

  if (variant === "row") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={saved}
          disabled={isPending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-ink px-6 text-base font-medium text-ink transition-colors hover:bg-surface-soft disabled:opacity-70"
        >
          {heart}
          {saved ? "Saved" : "Save for later"}
        </button>

        {error ? (
          <p role="alert" className="mt-1.5 text-xs font-medium text-error">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Saved. Remove from saved" : "Save for later"}
      title={error ?? undefined}
      // A 44px target with a smaller visible disc inside it.
      className={`flex size-11 items-center justify-center ${className}`}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-[#f2efe6] text-[#12111c] shadow-float">
        {heart}
      </span>
    </button>
  );
}
