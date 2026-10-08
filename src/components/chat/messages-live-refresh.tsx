"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useNewMessages } from "@/lib/use-new-messages";

/**
 * Re-fetches the current page when a message arrives.
 *
 * Renders nothing. Used on the Inbox, on My Listings and on the listing page,
 * where a new message or an accepted meetup changes what the server would
 * render. The page is re-rendered on the server through the ordinary queries,
 * so nothing from the realtime event itself is ever displayed.
 */
export function MessagesLiveRefresh({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
    };
  }, []);

  useNewMessages(() => {
    // A meetup change writes two rows in one transaction; one refresh will do.
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = setTimeout(() => router.refresh(), 200);
  }, conversationId);

  return null;
}
