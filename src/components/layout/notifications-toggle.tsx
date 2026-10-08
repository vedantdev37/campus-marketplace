"use client";

import { useState, useSyncExternalStore } from "react";

import {
  NOTIFY_EVENT,
  notificationsOn,
  notificationsSupported,
  setNotificationsPreference,
} from "@/lib/browser-notify";

function subscribe(onChange: () => void) {
  window.addEventListener(NOTIFY_EVENT, onChange);
  return () => window.removeEventListener(NOTIFY_EVENT, onChange);
}

/**
 * The Settings row for browser notifications.
 *
 * This row IS the in-app prompt: it says what you would be notified about,
 * and the browser's own permission dialog appears only when you press it.
 */
export function NotificationsToggle() {
  const isOn = useSyncExternalStore(subscribe, notificationsOn, () => false);
  const supported = useSyncExternalStore(subscribe, notificationsSupported, () => true);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    setMessage(null);

    if (isOn) {
      setNotificationsPreference(false);
      return;
    }

    // Asked here, in response to a press, and nowhere else.
    const permission =
      Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;

    if (permission !== "granted") {
      setMessage(
        "Your browser is blocking notifications for this site. Allow them in the site settings (the icon beside the address), then press this again.",
      );
      return;
    }

    setNotificationsPreference(true);
  }

  if (!supported) {
    return (
      <p className="px-3 py-2 text-sm text-ink-muted">
        This browser does not support notifications. Alerts still appear on the page.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isOn}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-base font-medium text-ink hover:bg-surface-soft"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill={isOn ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7zm4 10a2 2 0 004 0" />
        </svg>
        <span>
          {isOn ? "Notifications are on" : "Turn on notifications"}
          <span className="block text-sm font-normal text-ink-muted">
            A new chat message, or a saved item selling, while this site is open in another tab.
          </span>
        </span>
      </button>

      {message ? (
        <p role="alert" className="px-3 pb-2 text-sm text-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}
