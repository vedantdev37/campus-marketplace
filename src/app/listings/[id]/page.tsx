import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConditionSummary } from "@/components/listings/condition-summary";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { OwnerActions } from "@/components/listings/owner-actions";
import { requireSessionUser } from "@/lib/auth";
import { getListing } from "@/lib/listings";
import { fairPriceHint, formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/types/listing";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Listing · Campus Marketplace",
};

/**
 * The verdict is carried by a word and a shape, not by colour: there is no red
 * or green here, so it reads the same in greyscale and to someone who cannot
 * tell those two apart.
 */
const VERDICT = {
  great: { mark: "▼", label: "Below the usual price" },
  fair: { mark: "●", label: "In line with the usual price" },
  high: { mark: "▲", label: "Above the usual price" },
} as const;

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  // Checked before querying: Postgres rejects a malformed uuid with a syntax
  // error, which would surface as a 500 rather than a 404. A junk URL should be
  // "not found", not "something broke".
  if (!isUuid(id)) {
    notFound();
  }

  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  const isOwner = listing.seller_id === user.id;
  const isSold = listing.status === "sold";
  const imageUrl = listingImageUrl(listing.image_path);
  const hint = fairPriceHint(listing.price, listing.original_price, listing.condition);

  return (
    <main className="mx-auto w-full max-w-[1080px] flex-1 bg-canvas px-4 py-6 text-ink md:px-6 md:py-8">
      {/* Re-fetches this page when the listing changes, so a buyer looking at
          it sees it become sold without refreshing. */}
      <ListingLiveRefresh listingId={listing.id} />

      <Link
        href="/listings"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline"
      >
        ← Back to browse
      </Link>

      {/* Two columns from `md` up: the photo and description on the left, the
          price and actions in a card on the right that stays in view while the
          left side scrolls. One column on a phone, in reading order. */}
      <div className="mt-3 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-[14px] bg-surface-soft">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={`Photo of ${listing.title}`}
                fill
                sizes="(max-width: 768px) 100vw, 700px"
                // The largest thing on the page and above the fold, so it is
                // the Largest Contentful Paint element.
                priority
                className={[
                  listing.category === "books" ? "object-contain" : "object-cover",
                  "motion-safe:transition-[filter] motion-safe:duration-300",
                  isSold ? "grayscale" : "",
                ].join(" ")}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                No photo
              </div>
            )}

            {isSold ? (
              <span className="absolute top-4 left-4 rounded-full bg-ink px-3 py-1.5 text-xs leading-none font-semibold tracking-wide text-canvas uppercase">
                Sold
              </span>
            ) : null}
          </div>

          <h1 className="mt-6 text-[26px] leading-tight font-semibold">{listing.title}</h1>
          <p className="mt-1 text-base text-ink-muted">
            {CATEGORY_LABELS[listing.category]} · {CONDITION_LABELS[listing.condition]} condition
          </p>

          <p className="mt-6 border-t border-hairline pt-6 text-base leading-relaxed whitespace-pre-line text-ink-body">
            {listing.description}
          </p>

          <ConditionSummary category={listing.category} checks={listing.condition_checks} />

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-hairline pt-6 text-base">
            <Detail label="Seller" value={listing.seller?.full_name ?? "A student"} />
            <Detail label="Pickup" value={listing.pickup_spot?.name ?? "To be arranged"} />
            {listing.course_code ? <Detail label="Course" value={listing.course_code} /> : null}
            {listing.semester ? <Detail label="Semester" value={`Semester ${listing.semester}`} /> : null}
            {listing.book_author ? <Detail label="Author" value={listing.book_author} /> : null}
            {listing.isbn ? <Detail label="ISBN" value={listing.isbn} /> : null}
          </dl>
        </div>

        <aside className="md:sticky md:top-28 md:self-start">
          <div className="rounded-[14px] border border-hairline p-6">
            {/* Always in the DOM so a screen reader announces the change when
                the listing sells while the page is open. */}
            <p role="status" className={isSold ? "mb-3 text-base font-semibold" : "sr-only"}>
              {isSold ? "This item has been sold." : ""}
            </p>

            <p className="text-[26px] leading-none font-bold tabular-nums">
              <span className={isSold ? "text-ink-muted line-through" : ""}>
                {formatPrice(listing.price)}
              </span>
            </p>

            {listing.original_price ? (
              <p className="mt-2 text-sm text-ink-muted">
                Originally {formatPrice(listing.original_price)}
              </p>
            ) : null}

            {hint ? (
              <div className="mt-4 rounded-[14px] bg-surface-soft p-4 text-sm">
                <p className="font-semibold">
                  <span aria-hidden="true" className="mr-1.5">
                    {VERDICT[hint.verdict].mark}
                  </span>
                  {VERDICT[hint.verdict].label}
                </p>
                <p className="mt-1 text-ink-body">
                  {hint.percentOfOriginal}% of the original price. Items in{" "}
                  {CONDITION_LABELS[listing.condition].toLowerCase()} condition usually go for
                  around {formatPrice(hint.expected)}.
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  A guide only. The original price is supplied by the seller or a book catalogue.
                </p>
              </div>
            ) : null}

            <p className="mt-4 text-sm text-ink-body">
              Meet at{" "}
              <span className="font-semibold text-ink">
                {listing.pickup_spot?.name ?? "a spot you agree with the seller"}
              </span>
              .
            </p>
          </div>

          {isOwner ? (
            // Ownership decides only what is *shown* here. Each action re-checks
            // the session and scopes its query by seller_id, and RLS refuses the
            // row regardless - so hiding these controls is a convenience, never
            // the protection. See scripts/verify-rls.mjs.
            <OwnerActions listingId={listing.id} status={listing.status} />
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
