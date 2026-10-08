"use client";

import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Calls back when a message arrives in one of my conversations.
 *
 * The same contract as `useListingChanges`: the event is a signal that
 * something changed and carries no message text into the page. What is displayed
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
export function useNewMessages(
  onMessage: (message: { senderId: string | null }) => void,
  conversationId?: string,
): void {
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
      (payload) => {
        // The one field passed on is WHO sent it, so a listener can tell a
        // message from someone else apart from an echo of your own. The text
        // is not passed on: what a page shows is still fetched through RLS.
        const sender = (payload.new as { sender_id?: unknown }).sender_id;
        onMessageRef.current({ senderId: typeof sender === "string" ? sender : null });
      },
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
