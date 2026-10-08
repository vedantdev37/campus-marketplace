"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** What a subscriber is told about a change. Deliberately almost nothing. */
export type ListingChange = {
  type: "INSERT" | "UPDATE" | "DELETE";
  id: string | null;
  /** Only present on INSERT and UPDATE. */
  status: string | null;
};

/**
 * Subscribes to changes on the `listings` table through Supabase Realtime.
 *
 * WHAT THE PAYLOAD IS USED FOR
 * Realtime delivers the changed row, but this hook passes on only the id and
 * the status. Everything a page actually DISPLAYS still comes from the server,
 * through the normal RLS-filtered queries. A realtime event is treated as a
 * signal that something changed, never as the data itself - so a bug here can
 * make a page stale, but cannot make it show something a query would refuse.
 *
 * AUTH
 * The `anon` role has no access to `listings` (migration 0002), so an
 * unauthenticated socket would connect and then silently receive nothing.
 * `setAuth()` puts the user's JWT on the socket before subscribing, and
 * supabase-js refreshes it on the socket when the session token rotates.
 *
 * Pass `listingId` to hear about one listing only (the detail page); omit it to
 * hear about all of them (browse, My Listings).
 */
export function useListingChanges(
  onChange: (change: ListingChange) => void,
  listingId?: string,
): void {
  // The latest callback, without making it a dependency: re-subscribing every
  // time a parent re-renders would churn the socket for no reason.
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    // A unique name per mount, so two components on one page (or React's
    // development double-mount) never share and tear down each other's channel.
    const channel = supabase.channel(`listings:${listingId ?? "all"}:${crypto.randomUUID()}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "listings",
        ...(listingId ? { filter: `id=eq.${listingId}` } : {}),
      },
      (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as {
          id?: unknown;
          status?: unknown;
        };

        onChangeRef.current({
          type: payload.eventType,
          id: typeof row.id === "string" ? row.id : null,
          status: typeof row.status === "string" ? row.status : null,
        });
      },
    );

    void supabase.realtime.setAuth().then(() => {
      if (!cancelled) {
        channel.subscribe();
      }
    });

    return () => {
      cancelled = true;
      // Without this every visit to the page would leave a live subscription
      // behind, and the socket would keep delivering events to nothing.
      void supabase.removeChannel(channel);
    };
  }, [listingId]);
}
