"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useListingChanges } from "@/lib/use-listing-changes";

/**
 * Re-fetches the current page when a listing changes.
 *
 * Used on the detail page (for that one listing) and on My Listings (for all).
 * It renders nothing visible: the page re-renders on the server, so a listing
 * that was just marked sold shows its sold banner, and one that was deleted
 * becomes the not-found page - both through the ordinary queries.
 *
 * The one thing it adds itself is a screen-reader announcement, because a
 * banner appearing silently is invisible to someone not looking at the screen.
 */
export function ListingLiveRefresh({
  listingId,
  closedLabel = "Sold",
}: {
  listingId?: string;
  /** What "finished" is called for this kind of post: Sold, Rented out, Claimed... */
  closedLabel?: string;
}) {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState("");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
    };
  }, []);

  useListingChanges((change) => {
    if (listingId && change.type === "UPDATE" && change.status === "sold") {
      setAnnouncement(`This post was just marked: ${closedLabel.toLowerCase()}.`);
    }

    if (listingId && change.type === "DELETE") {
      setAnnouncement("This post was just removed.");
    }

    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = setTimeout(() => router.refresh(), 300);
  }, listingId);

  return (
    <p aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );
}
