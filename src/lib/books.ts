import "server-only";

import { normalizeIsbn } from "@/lib/isbn";

/**
 * Book lookup by ISBN.
 *
 * Two sources, tried in order:
 *
 *   1. Google Books - the only source that can return a list price.
 *   2. Open Library - used when Google has no match.
 *
 * The fallback is not decoration. At the time of writing, Google's `isbn:`
 * search returned zero results for every print ISBN tried with a valid API key
 * (Clean Code, CLRS, K&R and nine others), while a title search on the same key
 * worked and Open Library resolved the same ISBNs. With Google alone, the
 * feature would have reported "not found" for essentially every textbook.
 *
 * Server-only on purpose: the API key is read here, and this import makes the
 * build fail if a Client Component ever pulls the module in, rather than
 * letting the key ship to the browser.
 *
 * Nothing here throws for an expected failure. A lookup is a convenience for
 * pre-filling a form, so every way it can go wrong comes back as a value the
 * caller can show next to the ISBN field and carry on from.
 */

export type BookListPrice = {
  amount: number;
  /** ISO 4217 code exactly as the source reports it, e.g. "INR". Never converted. */
  currency: string;
};

export type BookSource = "google_books" | "open_library";

export type Book = {
  /** The normalised ISBN that was looked up: digits only, plus a final X. */
  isbn: string;
  title: string;
  authors: string[];
  /** Plain text, with any markup removed. */
  description: string | null;
  coverUrl: string | null;
  /** Only ever set from Google Books; Open Library carries no prices. */
  listPrice: BookListPrice | null;
  source: BookSource;
};

export type BookLookupFailureReason =
  | "invalid_isbn"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "unavailable";

export type BookLookupResult =
  | { ok: true; book: Book }
  | { ok: false; reason: BookLookupFailureReason; message: string };

const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_ENDPOINT = "https://openlibrary.org/api/books";

/**
 * Per source. Long enough for a slow campus connection, short enough that with
 * two sources in a row the person at the form is not left wondering whether
 * the button worked.
 */
const LOOKUP_TIMEOUT_MS = 5000;

/**
 * How long Next may reuse a successful response for the same ISBN.
 *
 * Book metadata does not change, and the daily request quota is the scarce
 * resource, so repeat lookups of a popular textbook should not each spend a
 * request. It is one hour rather than a day because an empty "no results"
 * answer is also a 200 and gets cached too; an hour bounds how long a wrong
 * "not found" can stick.
 */
const LOOKUP_REVALIDATE_SECONDS = 3600;

/**
 * Hosts a cover may be fetched from. Matched against the parsed hostname, so a
 * look-alike such as `books.google.com.example.org` cannot pass. This list is
 * also what makes importing a cover safe: the server only ever requests an
 * image from one of these, never from an address a client supplied.
 */
export const ALLOWED_COVER_HOSTS: readonly string[] = [
  "books.google.com",
  "books.googleusercontent.com",
  "covers.openlibrary.org",
];

/**
 * The `reason` values Google uses for quota problems. It reports some of them
 * with HTTP 403 rather than 429, and a plain 403 can also mean a bad or
 * restricted key, so the status code alone cannot tell the two apart.
 */
const QUOTA_ERROR_REASONS: readonly string[] = [
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "dailyLimitExceeded",
  "dailyLimitExceededUnreg",
  "quotaExceeded",
];

const FAILURE_MESSAGES: Record<BookLookupFailureReason, string> = {
  invalid_isbn: "That does not look like a valid ISBN. Check the digits and try again.",
  not_found: "No book was found for that ISBN. You can fill in the details yourself.",
  rate_limited: "Book lookup is busy right now. Try again later, or fill in the details yourself.",
  timeout: "Book lookup took too long. Try again, or fill in the details yourself.",
  unavailable: "Book lookup is not available right now. You can fill in the details yourself.",
};

type Failure = Extract<BookLookupResult, { ok: false }>;

function failure(reason: BookLookupFailureReason): Failure {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

// ---------------------------------------------------------------------------
// Narrowing responses
//
// Both responses are someone else's JSON, so they are treated as `unknown` and
// every field is checked before use. A missing or oddly-typed field becomes
// "absent", never an exception.
// ---------------------------------------------------------------------------

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A trimmed, non-empty string, or null for anything else. */
function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Google descriptions arrive as HTML fragments (<p>, <b>, <br>, entities).
 * The form field is plain text and the detail page renders it as text, so the
 * markup is removed here rather than shown to a buyer as literal tags.
 */
function toPlainText(value: unknown): string | null {
  const text = readText(value);
  if (text === null) {
    return null;
  }

  const plain = text
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

  return plain === "" ? null : plain;
}

/**
 * A factual one-line description built from catalogue data, for when the
 * source has no description of its own - which is the usual case on Open
 * Library. It gives the seller a correct starting point ("Prentice Hall, 2008,
 * 431 pages") to add their copy's condition to, and it never invents anything:
 * each part appears only if the source supplied it.
 */
function describeEdition(parts: {
  title: string;
  authors: string[];
  publisher: string | null;
  published: string | null;
  pages: number | null;
}): string {
  const byline = parts.authors.length > 0 ? ` by ${parts.authors.join(", ")}` : "";
  const facts = [
    parts.publisher,
    parts.published,
    parts.pages !== null ? `${parts.pages} pages` : null,
  ].filter((fact): fact is string => fact !== null);

  return `${parts.title}${byline}.${facts.length > 0 ? ` ${facts.join(", ")}.` : ""}`;
}

function readPageCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Upgrades to https and accepts the URL only on an allowed host. */
function toAllowedCoverUrl(rawUrl: string | null): string | null {
  if (rawUrl === null) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  if (!ALLOWED_COVER_HOSTS.includes(url.hostname)) {
    return null;
  }

  // Google serves covers as http:// links; https avoids mixed-content blocking.
  url.protocol = "https:";
  return url.toString();
}

/** `AbortSignal.timeout()` rejects with a DOMException named "TimeoutError". */
function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/** Parsed JSON, or null when the text is not JSON at all. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

type FetchedJson =
  | { ok: true; status: number; body: unknown }
  | { ok: false; reason: "timeout" | "unavailable" };

/** One GET with a timeout that also covers a body that stalls part-way. */
async function fetchJson(url: string, headers?: Record<string, string>): Promise<FetchedJson> {
  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: LOOKUP_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });

    const text = await response.text();
    return { ok: true, status: response.status, body: parseJson(text) };
  } catch (error) {
    // Anything that is not a timeout is DNS, TLS or a dropped connection.
    return { ok: false, reason: isTimeoutError(error) ? "timeout" : "unavailable" };
  }
}

// ---------------------------------------------------------------------------
// Google Books
// ---------------------------------------------------------------------------

function readGoogleAuthors(volumeInfo: JsonRecord): string[] {
  if (!Array.isArray(volumeInfo.authors)) {
    return [];
  }

  return volumeInfo.authors.map(readText).filter((name): name is string => name !== null);
}

function readGoogleCover(volumeInfo: JsonRecord): string | null {
  if (!isRecord(volumeInfo.imageLinks)) {
    return null;
  }

  return toAllowedCoverUrl(
    readText(volumeInfo.imageLinks.thumbnail) ?? readText(volumeInfo.imageLinks.smallThumbnail),
  );
}

function readPrice(value: unknown): BookListPrice | null {
  if (!isRecord(value)) {
    return null;
  }

  const amount = value.amount;
  const currency = readText(value.currencyCode);

  // A zero or negative "price" would feed the fair-price hint a nonsense
  // original price, so it is treated the same as no price at all.
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || currency === null) {
    return null;
  }

  return { amount, currency };
}

/**
 * `listPrice` is the publisher's price, which is what "original price" means
 * on a listing. `retailPrice` is Google's own (often discounted) selling price,
 * so it is only a fallback when the publisher's price is missing.
 */
function readGoogleListPrice(item: JsonRecord): BookListPrice | null {
  if (!isRecord(item.saleInfo)) {
    return null;
  }

  return readPrice(item.saleInfo.listPrice) ?? readPrice(item.saleInfo.retailPrice);
}

function googleItemHasIsbn(item: JsonRecord, isbn: string): boolean {
  if (!isRecord(item.volumeInfo) || !Array.isArray(item.volumeInfo.industryIdentifiers)) {
    return false;
  }

  return item.volumeInfo.industryIdentifiers.some((entry) => {
    if (!isRecord(entry) || typeof entry.identifier !== "string") {
      return false;
    }

    return entry.identifier.replace(/[\s-]/g, "").toUpperCase() === isbn;
  });
}

function isGoogleQuotaError(body: unknown): boolean {
  if (!isRecord(body) || !isRecord(body.error)) {
    return false;
  }

  if (body.error.status === "RESOURCE_EXHAUSTED") {
    return true;
  }

  if (!Array.isArray(body.error.errors)) {
    return false;
  }

  return body.error.errors.some(
    (entry) =>
      isRecord(entry) &&
      typeof entry.reason === "string" &&
      QUOTA_ERROR_REASONS.includes(entry.reason),
  );
}

function buildGoogleUrl(isbn: string): string {
  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  url.searchParams.set("q", `isbn:${isbn}`);

  // Read straight from process.env rather than `@/lib/env`: that module is the
  // public (NEXT_PUBLIC_) environment and is safe to import from the browser,
  // which is exactly where this key must never end up.
  //
  // In practice the key is required: without one Google now answers with
  // 429 RESOURCE_EXHAUSTED, a zero quota for anonymous callers.
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  return url.toString();
}

async function lookupGoogleBooks(isbn: string): Promise<BookLookupResult> {
  const fetched = await fetchJson(buildGoogleUrl(isbn));

  if (!fetched.ok) {
    return failure(fetched.reason);
  }

  const { status, body } = fetched;

  if (status === 429 || (status === 403 && isGoogleQuotaError(body))) {
    return failure("rate_limited");
  }

  if (status < 200 || status >= 300 || !isRecord(body)) {
    return failure("unavailable");
  }

  // No match comes back as 200 with `totalItems: 0` and no `items` key at all.
  if (!Array.isArray(body.items)) {
    return failure("not_found");
  }

  // `q=isbn:` is a search, not an exact-match lookup, so only an item that
  // actually lists the requested ISBN is trusted. Taking "the first result"
  // would autofill a listing with a different book.
  const item = body.items.filter(isRecord).find((entry) => googleItemHasIsbn(entry, isbn));

  if (!item || !isRecord(item.volumeInfo)) {
    return failure("not_found");
  }

  const title = readText(item.volumeInfo.title);
  if (title === null) {
    return failure("not_found");
  }

  const authors = readGoogleAuthors(item.volumeInfo);

  return {
    ok: true,
    book: {
      isbn,
      title,
      authors,
      description:
        toPlainText(item.volumeInfo.description) ??
        describeEdition({
          title,
          authors,
          publisher: readText(item.volumeInfo.publisher),
          published: readText(item.volumeInfo.publishedDate),
          pages: readPageCount(item.volumeInfo.pageCount),
        }),
      coverUrl: readGoogleCover(item.volumeInfo),
      listPrice: readGoogleListPrice(item),
      source: "google_books",
    },
  };
}

// ---------------------------------------------------------------------------
// Open Library
// ---------------------------------------------------------------------------

function readOpenLibraryAuthors(record: JsonRecord): string[] {
  if (!Array.isArray(record.authors)) {
    return [];
  }

  return record.authors
    .map((author) => (isRecord(author) ? readText(author.name) : null))
    .filter((name): name is string => name !== null);
}

/** The largest cover on offer; the form shows it small and saves it full size. */
function readOpenLibraryCover(record: JsonRecord): string | null {
  if (!isRecord(record.cover)) {
    return null;
  }

  return toAllowedCoverUrl(
    readText(record.cover.large) ?? readText(record.cover.medium) ?? readText(record.cover.small),
  );
}

/** `notes` is sometimes a string and sometimes `{ type, value }`. */
function readOpenLibraryNotes(record: JsonRecord): string | null {
  if (isRecord(record.notes)) {
    return toPlainText(record.notes.value);
  }

  return toPlainText(record.notes);
}

async function lookupOpenLibrary(isbn: string): Promise<BookLookupResult> {
  const url = new URL(OPEN_LIBRARY_ENDPOINT);
  url.searchParams.set("bibkeys", `ISBN:${isbn}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("jscmd", "data");

  // Open Library asks API users to identify themselves so that heavy callers
  // can be contacted rather than blocked.
  const fetched = await fetchJson(url.toString(), {
    "User-Agent": "CampusMarketplace/1.0 (student project; nmit-campus-marketplace.vercel.app)",
  });

  if (!fetched.ok) {
    return failure(fetched.reason);
  }

  const { status, body } = fetched;

  if (status === 429) {
    return failure("rate_limited");
  }

  if (status < 200 || status >= 300 || !isRecord(body)) {
    return failure("unavailable");
  }

  // An unknown ISBN is a 200 with an empty object.
  const record = body[`ISBN:${isbn}`];
  if (!isRecord(record)) {
    return failure("not_found");
  }

  const title = readText(record.title);
  if (title === null) {
    return failure("not_found");
  }

  const subtitle = readText(record.subtitle);
  const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
  const authors = readOpenLibraryAuthors(record);

  const firstPublisher =
    Array.isArray(record.publishers) && isRecord(record.publishers[0])
      ? readText(record.publishers[0].name)
      : null;

  return {
    ok: true,
    book: {
      isbn,
      title: fullTitle,
      authors,
      description:
        readOpenLibraryNotes(record) ??
        describeEdition({
          title: fullTitle,
          authors,
          publisher: firstPublisher,
          published: readText(record.publish_date),
          pages: readPageCount(record.number_of_pages),
        }),
      coverUrl: readOpenLibraryCover(record),
      listPrice: null,
      source: "open_library",
    },
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Looks a book up by ISBN-10 or ISBN-13.
 *
 * Hyphens and spaces in the input are fine. An ISBN with a wrong check digit
 * is rejected before any request is made.
 */
export async function lookupBookByIsbn(rawIsbn: string): Promise<BookLookupResult> {
  const isbn = normalizeIsbn(rawIsbn);
  if (isbn === null) {
    return failure("invalid_isbn");
  }

  const fromGoogle = await lookupGoogleBooks(isbn);
  if (fromGoogle.ok) {
    return fromGoogle;
  }

  // Tried whatever Google said - "not found", rate limited or down - because in
  // each case the second source may still have the book.
  const fromOpenLibrary = await lookupOpenLibrary(isbn);
  if (fromOpenLibrary.ok) {
    return fromOpenLibrary;
  }

  // Both failed, and the second source's answer is the one reported. Google's
  // "not found" is not trustworthy on its own (see the note at the top), so if
  // Open Library timed out the honest message is "try again", not "no such
  // book" - which would send the seller off to type everything by hand.
  return fromOpenLibrary;
}
