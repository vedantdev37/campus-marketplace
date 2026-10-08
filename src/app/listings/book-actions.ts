"use server";

import { requireSessionUser } from "@/lib/auth";
import { ALLOWED_COVER_HOSTS, lookupBookByIsbn, type Book } from "@/lib/books";
import { LISTING_IMAGE_BUCKET, LISTING_IMAGE_MAX_BYTES } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * What the form needs from a lookup. Narrower than `Book` on purpose: the
 * original price is reduced to a rupee amount or nothing, so the form cannot
 * mistake a dollar figure for rupees.
 */
export type BookAutofill = {
  isbn: string;
  title: string;
  author: string | null;
  description: string | null;
  /** For the preview only. The listing stores `coverPath`, never this URL. */
  coverUrl: string | null;
  /** A Storage path in the caller's own folder, when the cover was imported. */
  coverPath: string | null;
  /** Rupees, and only when the source priced the book in INR. */
  originalPriceInr: number | null;
  source: Book["source"];
};

export type BookLookupResponse =
  | { ok: true; book: BookAutofill }
  | { ok: false; reason: string; message: string };

// --- Throttle -----------------------------------------------------------------

const LOOKUPS_PER_MINUTE = 8;
const recentLookups = new Map<string, number[]>();

/**
 * A per-user limit on lookups, so one account cannot burn the shared Google
 * quota by hammering the button (or the action directly).
 *
 * This is deliberately modest and honest about its limits: the counts live in
 * this server instance's memory, so on a serverless host each instance keeps
 * its own tally and a cold start resets it. It stops accidental loops and
 * casual abuse, not a determined attacker - that would need a shared store.
 * The session check above it is the real gate: anonymous callers get nothing.
 */
function isThrottled(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (recentLookups.get(userId) ?? []).filter((time) => time > windowStart);

  if (recent.length >= LOOKUPS_PER_MINUTE) {
    recentLookups.set(userId, recent);
    return true;
  }

  recent.push(now);
  recentLookups.set(userId, recent);
  return false;
}

// --- Field limits ----------------------------------------------------------------

/** Cuts at a word boundary where it can, so a title does not end mid-word. */
function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }

  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// --- Cover import ----------------------------------------------------------------

const COVER_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Copies a book cover into the user's own Storage folder and returns its path.
 *
 * The listing keeps using `image_path` exactly as it does for an uploaded
 * photo, so nothing downstream needs to know the picture came from a book
 * database - and the listing does not break if that site changes its URLs.
 *
 * The URL fetched here comes from the lookup result, which this server just
 * produced, and it is checked against the cover-host allowlist again before the
 * request. It is never an address the browser sent, which is what would make
 * "fetch this URL for me" a way to probe internal services.
 *
 * Returns null on any failure: a missing cover must not fail the lookup.
 */
async function importCover(coverUrl: string, userId: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(coverUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !ALLOWED_COVER_HOSTS.includes(url.hostname)) {
    return null;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!response.ok) {
      return null;
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const extension = COVER_CONTENT_TYPES[contentType];

    if (!extension) {
      return null;
    }

    const bytes = await response.arrayBuffer();

    // Under ~1 KB is a placeholder pixel, not a cover.
    if (bytes.byteLength < 1024 || bytes.byteLength > LISTING_IMAGE_MAX_BYTES) {
      return null;
    }

    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const supabase = await createSupabaseServerClient();

    // Uploaded with the user's own session, so the Storage policy (first path
    // segment must equal auth.uid()) applies to this write like any other.
    const { error } = await supabase.storage
      .from(LISTING_IMAGE_BUCKET)
      .upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });

    return error ? null : path;
  } catch {
    return null;
  }
}

// --- The action -------------------------------------------------------------------

/**
 * Looks a book up by ISBN for the listing form.
 *
 * A Server Action rather than a call from the browser, so the Google API key
 * stays on the server. `wantsCover` is false when the seller has already chosen
 * their own photo, in which case no cover is imported.
 */
export async function lookupBookAction(
  rawIsbn: string,
  wantsCover: boolean,
): Promise<BookLookupResponse> {
  // Anonymous callers are redirected to login before any quota is spent.
  const user = await requireSessionUser();

  if (typeof rawIsbn !== "string" || rawIsbn.length > 40) {
    return { ok: false, reason: "invalid_isbn", message: "That does not look like a valid ISBN." };
  }

  if (isThrottled(user.id)) {
    return {
      ok: false,
      reason: "rate_limited",
      message: "That is a lot of lookups. Wait a minute, or fill in the details yourself.",
    };
  }

  const result = await lookupBookByIsbn(rawIsbn);

  if (!result.ok) {
    return result;
  }

  const { book } = result;

  const coverPath =
    wantsCover === true && book.coverUrl ? await importCover(book.coverUrl, user.id) : null;

  // Only an INR price can go in a field labelled in rupees. A book priced in
  // dollars is left blank for the seller to fill in from the printed MRP,
  // rather than converted at a rate that would be a guess.
  const originalPriceInr =
    book.listPrice?.currency === "INR" && book.listPrice.amount <= 1_000_000
      ? Math.round(book.listPrice.amount * 100) / 100
      : null;

  return {
    ok: true,
    book: {
      isbn: book.isbn,
      // Trimmed to the same limits the listing schema and the database enforce,
      // so an autofilled value can never be the reason a save is rejected.
      title: truncate(book.title, 120),
      author: book.authors.length > 0 ? truncate(book.authors.join(", "), 160) : null,
      description: book.description ? truncate(book.description, 2000) : null,
      coverUrl: book.coverUrl,
      coverPath,
      originalPriceInr,
      source: book.source,
    },
  };
}
