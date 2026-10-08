"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { notifyInBackground } from "@/lib/browser-notify";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useListingChanges } from "@/lib/use-listing-changes";
import { useNewMessages } from "@/lib/use-new-messages";

type Alert = { id: string; text: string; href: string };

/** How long an alert stays on screen before it removes itself. */
const SHOWN_FOR_MS = 12000;

/**
 * Tells a signed-in user, wherever they are on the site, when a post they
 * saved has just sold - and, if they have turned notifications on and the tab
 * is in the background, raises a browser notification for that and for a new
 * chat message.
 *
 * HOW IT KNOWS A SAVED POST SOLD
 * Two things, both already there. Every signed-in user may subscribe to
 * changes on `listings` (it is how browse greys a card out live). And this
 * component holds the ids and titles of what the user has saved, read from
 * `wishlist_items` under RLS, which returns only their own rows. A "sold"
 * event whose id is in that list is the one to announce. The title shown
 * comes from that list, not from the event.
 *
 * The saved list is re-read whenever the user saves or removes something on
 * this device (a `saved:change` event) and when the tab comes back into view.
 */
export function LiveAlerts({ userId }: { userId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const savedRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      const supabase = createSupabaseBrowserClient();
      const { data: rows } = await supabase.from("wishlist_items").select("listing_id").eq("user_id", userId);
      const ids = (rows ?? []).map((row) => row.listing_id as string);

      if (ids.length === 0) {
        if (!cancelled) {
          savedRef.current = new Map();
        }
        return;
      }

      const { data: listings } = await supabase.from("listings").select("id, title").in("id", ids);

      if (!cancelled) {
        savedRef.current = new Map((listings ?? []).map((listing) => [listing.id as string, listing.title as string]));
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadSaved();
      }
    };

    void loadSaved();
    window.addEventListener("saved:change", loadSaved);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("saved:change", loadSaved);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  function show(alert: Alert) {
    setAlerts((current) => [...current.filter((existing) => existing.id !== alert.id), alert]);
    setTimeout(() => {
      setAlerts((current) => current.filter((existing) => existing.id !== alert.id));
    }, SHOWN_FOR_MS);
  }

  useListingChanges((change) => {
    if (change.type !== "UPDATE" || change.status !== "sold" || !change.id) {
      return;
    }

    const title = savedRef.current.get(change.id);

    if (!title) {
      return;
    }

    const href = `/listings/${change.id}`;
    show({ id: change.id, text: `Your saved item just sold: ${title}`, href });
    notifyInBackground("Your saved item just sold", title, href);
  });

  useNewMessages(({ senderId }) => {
    // My own message echoes back to my other tabs. That is not news.
    if (senderId && senderId !== userId) {
      notifyInBackground("New message on Nitte Mart", "Open your inbox to read it.", "/inbox");
    }
  });

  return (
    // Above the phone tab bar, out of the way of the page. `role="status"` so
    // a screen reader announces an alert when it appears.
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[14px] border border-hairline bg-canvas p-3 pl-4 text-sm text-ink shadow-float"
        >
          <p className="min-w-0 flex-1 font-semibold">{alert.text}</p>
          <Link
            href={alert.href}
            className="flex h-11 shrink-0 items-center rounded-lg border border-ink px-3 font-medium hover:bg-surface-soft"
          >
            View
          </Link>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setAlerts((current) => current.filter((existing) => existing.id !== alert.id))}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg hover:bg-surface-soft"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
