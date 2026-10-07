/** Where to land when no valid destination was requested. */
export const DEFAULT_SIGNED_IN_PATH = "/listings";

/**
 * Is this a safe same-site destination?
 *
 * Only absolute paths on this origin are accepted. Rejecting anything else is
 * what stops `?next=` becoming an open redirect: a link such as
 * `/login?next=https://evil.example` would otherwise bounce the user to an
 * attacker's page *after* a genuine login on our real domain, which is a
 * convincing phishing step.
 *
 * `//evil.example` is rejected too - browsers treat a protocol-relative URL as
 * absolute, so a leading-slash check alone is not enough. Backslashes are
 * rejected because some user agents normalise them to forward slashes.
 */
export function isSafeNextPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !value.includes("\\")
  );
}

/** The requested destination if it is safe, otherwise the default. */
export function safeNextPath(value: unknown): string {
  return isSafeNextPath(value) ? value : DEFAULT_SIGNED_IN_PATH;
}
