"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ListingCard } from "@/components/listings/listing-card";
import type { Listing } from "@/lib/types/listing";
import { useListingChanges } from "@/lib/use-listing-changes";

/** How long to wait for further changes before re-fetching the page. */
const REFRESH_DEBOUNCE_MS = 600;

/**
 * The browse grid, kept live.
 *
 * When a listing on screen is marked sold, its card greys out IN PLACE and
 * gains a Sold label - it does not vanish. Browse normally hides sold items, so
 * a plain re-fetch would make the card someone was just looking at disappear
 * with no explanation. Keeping it, visibly sold, tells them what happened. It
 * goes on the next navigation or filter change, like any other sold listing.
 *
 * Every other change (a new listing, an edit, a delete, a relist) re-fetches
 * the page through the server, so what is displayed always comes from the
 * normal RLS-filtered query. The realtime event only says "look again".
 */
export function LiveListingGrid({ listings }: { listings: Listing[] }) {
  const router = useRouter();

  /** Ids that sold while this page was open. */
  const [soldIds, setSoldIds] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
    };
  }, []);

  function scheduleRefresh() {
    // Debounced: a seed script or a burst of edits produces many events, and
    // each would otherwise trigger its own full re-render of the page.
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
  }

  useListingChanges((change) => {
    const shown = change.id ? listings.find((listing) => listing.id === change.id) : undefined;

    if (change.type === "UPDATE" && change.status === "sold" && shown && change.id) {
      const soldId = change.id;

      setSoldIds((previous) => new Set(previous).add(soldId));
      // The title comes from data this page already rendered, not the event.
      setAnnouncement(`${shown.title} was just sold.`);
      return;
    }

    if (change.type === "UPDATE" && change.status === "available" && change.id) {
      // Relisted: drop the local sold mark so the re-fetch can show it normally.
      const relistedId = change.id;

      setSoldIds((previous) => {
        if (!previous.has(relistedId)) {
          return previous;
        }

        const next = new Set(previous);
        next.delete(relistedId);
        return next;
      });
    }

    scheduleRefresh();
  });

  return (
    <>
      {/* One polite announcement for the whole grid, rather than every card
          being its own live region. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {listings.map((listing) => (
          <li key={listing.id} className="contents">
            <ListingCard
              listing={soldIds.has(listing.id) ? { ...listing, status: "sold" } : listing}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
