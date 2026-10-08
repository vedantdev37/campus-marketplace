"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useNewMessages } from "@/lib/use-new-messages";

/** Fired by a chat page after it marks its conversation as read. */
export const CHAT_READ_EVENT = "chat:read";

const UnreadContext = createContext(0);

/** The count from the database, or null if it could not be read. */
async function fetchUnreadCount(): Promise<number | null> {
  const { data, error } = await createSupabaseBrowserClient().rpc("my_unread_count");
  return !error && typeof data === "number" ? data : null;
}

/** How many messages are waiting for me, across all my conversations. */
export function useUnreadCount(): number {
  return useContext(UnreadContext);
}

/**
 * Keeps the header's unread count current.
 *
 * The header lives in the root layout, which is not re-rendered on navigation,
 * so a count rendered there on the server would go stale the moment a message
 * arrived or was read. This asks the database instead - `my_unread_count()`,
 * which runs under RLS as the signed-in user - whenever the answer could have
 * changed: on load, on navigation, when a message arrives, when a chat page
 * reports that it has been read, and when the tab comes back into view.
 *
 * One provider wraps the header so the desktop link, the phone menu and the
 * menu button share a single count and a single subscription.
 */
export function UnreadProvider({
  userId,
  children,
}: {
  /** Re-subscribes when a different person signs in on this tab. */
  userId: string;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  // Applied from a promise callback, never synchronously in an effect body.
  const refresh = useCallback(() => {
    void fetchUnreadCount().then((value) => {
      // On failure the last known count stays: a dropped connection should
      // not make the badge flicker to zero.
      if (value !== null) {
        setCount(value);
      }
    });
  }, []);

  useNewMessages(refresh);

  useEffect(() => {
    refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener(CHAT_READ_EVENT, refresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener(CHAT_READ_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, pathname, userId]);

  return <UnreadContext value={count}>{children}</UnreadContext>;
}

/**
 * The unread count as a small pill. Renders nothing at zero.
 *
 * A number in a filled pill, with "unread" for screen readers: the count is
 * carried by text and shape, so it does not depend on seeing a colour.
 */
export function UnreadPill({ count }: { count?: number }) {
  const fromContext = useUnreadCount();
  const value = count ?? fromContext;

  if (value <= 0) {
    return null;
  }

  return (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] leading-none font-semibold text-canvas tabular-nums">
      {value > 99 ? "99+" : value}
      <span className="sr-only"> unread</span>
    </span>
  );
}
