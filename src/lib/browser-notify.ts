/**
 * Browser notifications, while the site is open in a background tab.
 *
 * WHAT THIS IS, AND IS NOT
 * This uses the Notification API directly from an open page. It can tell you
 * something happened when Nitte Mart is in a tab you are not looking at. It
 * cannot reach you when the site is closed, because there is nothing running
 * to receive the event: that is what real push notifications are for, and
 * they need three things this project does not have -
 *
 *   1. a service worker, which the browser can wake when the page is shut;
 *   2. a Push API subscription per device, stored in the database;
 *   3. a server that sends to those subscriptions (signed with VAPID keys)
 *      when a message is inserted or a saved item sells.
 *
 * WHEN PERMISSION IS ASKED
 * Never on page load. The browser prompt appears only after the user presses
 * "Turn on notifications" in Settings, which says what they will be told
 * about. A site that asks before saying why gets blocked, and deserves it.
 *
 * The preference lives in localStorage: it is about this browser, and there
 * is no reason for the server to know.
 */

const PREFERENCE_KEY = "nitte-mart:notify";
export const NOTIFY_EVENT = "notifychange";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** On only if the user turned it on here AND the browser still allows it. */
export function notificationsOn(): boolean {
  try {
    return (
      notificationsSupported() &&
      Notification.permission === "granted" &&
      window.localStorage.getItem(PREFERENCE_KEY) === "on"
    );
  } catch {
    return false;
  }
}

export function setNotificationsPreference(on: boolean): void {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, on ? "on" : "off");
  } catch {
    // Private browsing can refuse storage. The setting then lasts for the visit.
  }

  window.dispatchEvent(new Event(NOTIFY_EVENT));
}

/**
 * Show a notification, but only when it would be useful: notifications are
 * on, and this tab is not the one being looked at. If you are reading the
 * page, the page itself tells you.
 */
export function notifyInBackground(title: string, body: string, url: string): void {
  if (!notificationsOn() || document.visibilityState === "visible") {
    return;
  }

  try {
    const notification = new Notification(title, { body, tag: url });

    notification.onclick = () => {
      window.focus();
      window.location.assign(url);
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
    // There the in-page alert is all there is.
  }
}
