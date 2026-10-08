import "server-only";

/**
 * Book lookup by ISBN, backed by the Google Books API.
 *
 * Server-only on purpose: the optional API key is read here, and this import
 * makes the build fail if a Client Component ever pulls the module in, rather
 * than letting the key ship to the browser.
 *
 * Nothing here throws for an expected failure. A lookup is a convenience for
 * pre-filling a form, so every way it can go wrong comes back as a value the
 * caller can show next to the ISBN field and carry on from.
 */

export type BookListPrice = {
  amount: number;
  /** ISO 4217 code exactly as Google reports it, e.g. "INR". Never converted. */
  currency: string;
};

export type Book = {
  /** The normalised ISBN that was looked up: digits only, plus a final X. */
  isbn: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  listPrice: BookListPrice | null;
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

/**
 * Long enough for a slow campus connection, short enough that the person
 * filling in the form is not left wondering whether the button worked.
 */
const LOOKUP_TIMEOUT_MS = 6000;

/**
 * How long Next may reuse a successful response for the same ISBN.
 *
 * Book metadata does not change, and the daily request quota is the scarce
 * resource, so repeat lookups of a popular textbook should not each spend a
 * request. It is one hour rather than a day because an empty "no results"
 * answer is also a 200 and gets cached too; an hour bounds how long a wrong
 * "not found" can stick. Next only stores 200 responses, so a rate-limit or
 * server error is never remembered.
 */
const LOOKUP_REVALIDATE_SECONDS = 3600;

/**
 * Must stay in step with `images.remotePatterns` in next.config.ts. A cover
 * on any other host would make next/image throw at render time, which is far
 * worse than showing no cover.
 */
const ALLOWED_COVER_HOSTS: readonly string[] = [
  "books.google.com",
  "books.googleusercontent.com",
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

function failure(reason: BookLookupFailureReason): BookLookupResult {
  return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
}

// ---------------------------------------------------------------------------
// ISBN handling
// ---------------------------------------------------------------------------

/**
 * Strips the hyphens and spaces people copy from a back cover, and upper-cases
 * the X that an ISBN-10 may end in.
 *
 * Returns null unless the result is a well-formed ISBN-10 or ISBN-13 with a
 * correct check digit. Checking the digit here means a typo is caught without
 * spending a network request (and a unit of quota) on it.
 */
export function normalizeIsbn(rawIsbn: string): string | null {
  const isbn = rawIsbn.replace(/[\s-]/g, "").toUpperCase();

  if (/^\d{9}[\dX]$/.test(isbn)) {
    return hasValidIsbn10CheckDigit(isbn) ? isbn : null;
  }

  if (/^\d{13}$/.test(isbn)) {
    return hasValidIsbn13CheckDigit(isbn) ? isbn : null;
  }

  return null;
}

/**
 * ISBN-10: weight the digits 10 down to 1; the total must divide by 11.
 * The last character may be X, standing for the value 10.
 */
function hasValidIsbn10CheckDigit(isbn: string): boolean {
  let sum = 0;

  for (let index = 0; index < 10; index += 1) {
    const character = isbn[index];
    const value = character === "X" ? 10 : Number(character);
    sum += value * (10 - index);
  }

  return sum % 11 === 0;
}

/** ISBN-13: weight the digits 1, 3, 1, 3, ...; the total must divide by 10. */
function hasValidIsbn13CheckDigit(isbn: string): boolean {
  let sum = 0;

  for (let index = 0; index < 13; index += 1) {
    const weight = index % 2 === 0 ? 1 : 3;
    sum += Number(isbn[index]) * weight;
  }

  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Narrowing the response
//
// The response is someone else's JSON, so it is treated as `unknown` and every
// field is checked before use. A missing or oddly-typed field becomes "absent",
// never an exception.
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

function readAuthors(volumeInfo: JsonRecord): string[] {
  if (!Array.isArray(volumeInfo.authors)) {
    return [];
  }

  const authors: string[] = [];

  for (const entry of volumeInfo.authors) {
    const name = readText(entry);
    if (name !== null) {
      authors.push(name);
    }
  }

  return authors;
}

/**
 * Google serves covers as `http://` links; they are upgraded to https so the
 * page does not trigger mixed-content blocking. The host is checked after
 * parsing, not with a string prefix test, so a look-alike such as
 * `books.google.com.example.org` cannot pass.
 */
function readCoverUrl(volumeInfo: JsonRecord): string | null {
  if (!isRecord(volumeInfo.imageLinks)) {
    return null;
  }

  const rawUrl =
    readText(volumeInfo.imageLinks.thumbnail) ?? readText(volumeInfo.imageLinks.smallThumbnail);

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

  url.protocol = "https:";
  return url.toString();
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
function readListPrice(item: JsonRecord): BookListPrice | null {
  if (!isRecord(item.saleInfo)) {
    return null;
  }

  return readPrice(item.saleInfo.listPrice) ?? readPrice(item.saleInfo.retailPrice);
}

function itemHasIsbn(item: JsonRecord, isbn: string): boolean {
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

/**
 * `q=isbn:` is a search, not an exact-match lookup, so it can return more than
 * one volume. An item that actually lists the requested ISBN is preferred;
 * otherwise the first one is used, since Google orders results by relevance.
 */
function pickBestItem(items: unknown[], isbn: string): JsonRecord | null {
  const records = items.filter(isRecord);

  return records.find((item) => itemHasIsbn(item, isbn)) ?? records[0] ?? null;
}

function isQuotaError(body: unknown): boolean {
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

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

function buildLookupUrl(isbn: string): string {
  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  url.searchParams.set("q", `isbn:${isbn}`);

  // Read straight from process.env rather than `@/lib/env`: that module is the
  // public (NEXT_PUBLIC_) environment and is safe to import from the browser,
  // which is exactly where this key must never end up.
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

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

  let status: number;
  let text: string;

  try {
    const response = await fetch(buildLookupUrl(isbn), {
      next: { revalidate: LOOKUP_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });

    status = response.status;
    // Read inside the try block: the timeout also covers a body that stalls
    // part-way through, and that surfaces here rather than from fetch().
    text = await response.text();
  } catch (error) {
    // Anything else is DNS, TLS or a dropped connection - all "not available".
    return failure(isTimeoutError(error) ? "timeout" : "unavailable");
  }

  const body = parseJson(text);

  if (status === 429 || (status === 403 && isQuotaError(body))) {
    return failure("rate_limited");
  }

  if (status < 200 || status >= 300 || !isRecord(body)) {
    return failure("unavailable");
  }

  // An ISBN nobody has catalogued comes back as 200 with `totalItems: 0` and
  // no `items` key at all.
  if (!Array.isArray(body.items)) {
    return failure("not_found");
  }

  const item = pickBestItem(body.items, isbn);
  if (item === null || !isRecord(item.volumeInfo)) {
    return failure("not_found");
  }

  // A record without a title gives the form nothing to pre-fill, so it is
  // reported as not found rather than returned as a book called "".
  const title = readText(item.volumeInfo.title);
  if (title === null) {
    return failure("not_found");
  }

  return {
    ok: true,
    book: {
      isbn,
      title,
      authors: readAuthors(item.volumeInfo),
      coverUrl: readCoverUrl(item.volumeInfo),
      listPrice: readListPrice(item),
    },
  };
}
