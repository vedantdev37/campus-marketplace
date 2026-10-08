"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Calls back when a message arrives in one of my conversations.
 *
 * The same contract as `useListingChanges`: the event is a signal that
 * something changed and carries no content into the page. What is displayed
 * is re-fetched from the server through RLS. Meetup proposals, acceptances and
 * cancellations each insert a message row too (migration 0008), so this one
 * subscription covers every change a chat page shows.
 *
 * WHO RECEIVES WHAT
 * Realtime checks the `messages` SELECT policy for each subscriber, so a user
 * only receives inserts for conversations they are part of. Only INSERT is
 * subscribed to. A DELETE cannot be checked against a policy - the row is gone
 * - so Supabase sends those to every subscriber, carrying the primary key and
 * nothing else; this hook has no use for them and does not ask.
 *
 * Pass `conversationId` to hear about one conversation, or omit it to hear
 * about all of mine (the Inbox, the header badge).
 */
export function useNewMessages(onMessage: () => void, conversationId?: string): void {
  // The latest callback, without making it a dependency: re-subscribing every
  // time a parent re-renders would churn the socket for no reason.
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    const channel = supabase.channel(`messages:${conversationId ?? "all"}:${crypto.randomUUID()}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
      },
      () => onMessageRef.current(),
    );

    // The user's JWT must be on the socket before subscribing: `anon` has no
    // access to `messages`, so an unauthenticated socket would connect and
    // then silently receive nothing.
    void supabase.realtime.setAuth().then(() => {
      if (!cancelled) {
        channel.subscribe();
      }
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
