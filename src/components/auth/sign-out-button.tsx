import { signOutAction } from "@/app/(auth)/actions";

/**
 * Sign out, as a form rather than an onClick handler.
 *
 * Two reasons: it works with JavaScript disabled or still loading, and signing
 * out is a state change, which belongs in a POST rather than a link someone's
 * browser or a crawler might prefetch.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted"
      >
        Sign out
      </button>
    </form>
  );
}
