/**
 * The home page hero's images: every image file in public/hero/, in filename
 * order.
 *
 * The list is worked out at BUILD time, in next.config.ts, and arrives here as
 * an environment value. It is not read from disk when a request comes in, and
 * that is deliberate: on Vercel the contents of public/ are served by the CDN
 * and are not guaranteed to exist on the server function's filesystem, so a
 * readdir() at request time works on a laptop and returns nothing in
 * production.
 *
 * To change the photos, replace the files in public/hero/ and redeploy (or
 * restart the dev server). Numbering them 01-, 02-, ... sets the order.
 */
export function getHeroImages(): string[] {
  try {
    const parsed: unknown = JSON.parse(process.env.HERO_IMAGES ?? "[]");

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    // No list means no photos: the hero falls back to its dark background and
    // headline, which is better than an error on the home page.
    return [];
  }
}
