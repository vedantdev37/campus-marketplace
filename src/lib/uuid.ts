/**
 * Is this string a UUID?
 *
 * Route ids are checked with this before they reach Postgres. The check used to
 * be `/^[0-9a-f-]{36}$/`, which only counts characters: thirty-six hyphens
 * passed it, Postgres then rejected the value as a malformed uuid, and the page
 * answered with a 500 instead of a 404. Matching the real 8-4-4-4-12 layout
 * means a junk URL is "not found", never "something broke".
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
