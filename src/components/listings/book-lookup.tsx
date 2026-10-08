"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { lookupBookAction, type BookAutofill } from "@/app/listings/book-actions";
import { BarcodeScanner } from "@/components/listings/barcode-scanner";
import { Field, SECONDARY_BUTTON_CLASS } from "@/components/listings/form-field";
import { normalizeIsbn } from "@/lib/isbn";

type LookupStatus =
  | { kind: "idle" }
  | { kind: "loading"; isbn: string }
  | { kind: "found"; book: BookAutofill }
  | { kind: "not_found"; isbn: string }
  | { kind: "failed"; message: string };

type BookLookupProps = {
  defaultIsbn: string;
  defaultAuthor: string;
  isbnError?: string;
  authorError?: string;
  /** Hint shown under Author after it was filled in from a lookup. */
  authorHint?: string;
  /** False when the seller already has a photo, so no cover is imported. */
  wantsCover: boolean;
  onBook: (book: BookAutofill) => void;
  onAuthorEdited: () => void;
};

/** Camera support never changes during a visit, so there is nothing to listen to. */
function subscribeToNothing() {
  return () => {};
}

/** getUserMedia only exists in a secure context (https or localhost). */
function browserCanScan(): boolean {
  return window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function";
}

const SOURCE_LABELS: Record<BookAutofill["source"], string> = {
  google_books: "Google Books",
  open_library: "Open Library",
};

/**
 * The "find this book by its ISBN" card on the listing form.
 *
 * Two ways in, one path out: a typed ISBN and a scanned barcode both end up in
 * the same `lookup()` call, so there is a single set of loading, not-found and
 * error states to get right. Typing is the primary route - it works on every
 * device, including the desktop a reviewer is likely to use - and the camera is
 * an enhancement offered only where it can work.
 *
 * Nothing here can block the seller: every failure says "fill in the details
 * yourself", and the fields below are ordinary inputs whatever happens.
 */
export function BookLookup({
  defaultIsbn,
  defaultAuthor,
  isbnError,
  authorError,
  authorHint,
  wantsCover,
  onBook,
  onAuthorEdited,
}: BookLookupProps) {
  const [isbn, setIsbn] = useState(defaultIsbn);
  const [status, setStatus] = useState<LookupStatus>({ kind: "idle" });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [, startLookup] = useTransition();

  // Whether this browser can open a camera at all. Read through
  // useSyncExternalStore so the server render and the first client render both
  // say "no" (the server has no camera to ask about), and the real answer
  // arrives after hydration without a mismatch warning or a setState-in-effect.
  const canScan = useSyncExternalStore(subscribeToNothing, browserCanScan, () => false);

  function lookup(rawIsbn: string) {
    const normalised = normalizeIsbn(rawIsbn);

    // The check digit is verified here first, so a typo gets an instant answer
    // and never costs a request against the shared API quota.
    if (normalised === null) {
      setStatus({
        kind: "failed",
        message: "That does not look like a valid ISBN. Check the digits and try again.",
      });
      return;
    }

    setStatus({ kind: "loading", isbn: normalised });

    startLookup(async () => {
      try {
        const response = await lookupBookAction(normalised, wantsCover);

        if (response.ok) {
          setStatus({ kind: "found", book: response.book });
          onBook(response.book);
        } else {
          // "No such book" is an ordinary outcome, not a fault, so it gets its
          // own calm state rather than sharing the error styling.
          setStatus(
            response.reason === "not_found"
              ? { kind: "not_found", isbn: normalised }
              : { kind: "failed", message: response.message },
          );
        }
      } catch {
        // The action itself did not complete: offline, or the server errored.
        setStatus({
          kind: "failed",
          message: "Could not reach the book lookup. Check your connection, or fill in the details yourself.",
        });
      }
    });
  }

  function handleDetected(scannedIsbn: string) {
    setIsScannerOpen(false);
    setIsbn(scannedIsbn);
    lookup(scannedIsbn);
  }

  const isLoading = status.kind === "loading";

  return (
    <section
      aria-labelledby="book-lookup-heading"
      className="flex flex-col gap-4 rounded-[14px] border border-hairline p-4"
    >
      <div>
        <h2 id="book-lookup-heading" className="text-base font-semibold text-ink">
          Find your book by ISBN
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          It is the 13-digit number by the barcode on the back cover. We will fill in what we can.
        </p>
      </div>

      <Field label="ISBN" name="isbn" error={isbnError}>
        {(props) => (
          <input
            {...props}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            placeholder="e.g. 978-0-13-235088-4…"
            spellCheck={false}
            value={isbn}
            onChange={(event) => setIsbn(event.currentTarget.value)}
            onKeyDown={(event) => {
              // Enter here should look the book up, not submit the whole listing.
              if (event.key === "Enter") {
                event.preventDefault();
                lookup(isbn);
              }
            }}
          />
        )}
      </Field>

      <div className={`grid gap-3 ${canScan ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={() => lookup(isbn)}
          disabled={isLoading || isbn.trim() === ""}
          className={SECONDARY_BUTTON_CLASS}
        >
          {isLoading ? "Looking up…" : "Look up"}
        </button>

        {canScan ? (
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            disabled={isLoading}
            className={SECONDARY_BUTTON_CLASS}
          >
            Scan barcode
          </button>
        ) : null}
      </div>

      {/* One live region for every outcome, so each is announced as it happens. */}
      <div aria-live="polite">
        {status.kind === "loading" ? (
          <p className="rounded-lg bg-surface-soft px-3 py-3 text-sm text-ink">
            Finding book {status.isbn}…
          </p>
        ) : null}

        {status.kind === "failed" ? (
          <p className="rounded-lg border border-hairline px-3 py-3 text-sm text-error">
            {status.message}
          </p>
        ) : null}

        {status.kind === "not_found" ? (
          // Deliberately neutral: plenty of Indian textbooks are in neither
          // database, so this will be seen often and must not read as broken.
          <div className="rounded-lg bg-surface-soft px-4 py-3 text-sm text-ink">
            <p className="font-semibold">
              This book is too rare for the internet. Fill it in yourself, legend.
            </p>
            <p className="mt-0.5 text-ink-body">
              Not every book is in the catalogues we search. We have kept ISBN {status.isbn} on
              your listing, so buyers can still find it by that number.
            </p>
          </div>
        ) : null}

        {status.kind === "found" ? (
          <div className="flex items-center gap-3 rounded-lg border border-hairline p-3">
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded bg-surface-soft">
              {status.book.coverUrl ? (
                // A plain <img>: this is a small transient preview from a book
                // database, not worth routing through the image optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={status.book.coverUrl}
                  alt=""
                  width={48}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-ink">{status.book.title}</p>
              <p className="truncate text-sm text-ink-muted">
                {status.book.author ?? "Author not listed"}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Found on {SOURCE_LABELS[status.book.source]}. Check the details below and edit
                anything that is wrong.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <Field label="Author" name="bookAuthor" error={authorError} hint={authorHint}>
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={160}
            defaultValue={defaultAuthor}
            onInput={onAuthorEdited}
          />
        )}
      </Field>

      {isScannerOpen ? (
        <BarcodeScanner onDetected={handleDetected} onClose={() => setIsScannerOpen(false)} />
      ) : null}
    </section>
  );
}
