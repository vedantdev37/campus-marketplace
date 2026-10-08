import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConditionSummary } from "@/components/listings/condition-summary";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { OwnerActions } from "@/components/listings/owner-actions";
import { requireSessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/uuid";
import { getListing } from "@/lib/listings";
import { fairPriceHint, formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/types/listing";

const VERDICT_CLASS = {
  great: "border-success/30 bg-success-surface text-success",
  fair: "border-border bg-surface-muted text-muted",
  high: "border-danger/30 bg-danger-surface text-danger",
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
      {/* Re-fetches this page when the listing changes, so a buyer looking at
          it sees it become sold without refreshing. */}
      <ListingLiveRefresh listingId={listing.id} />

      <Link href="/listings" className="text-sm text-muted hover:underline">
        ← Back to browse
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="relative aspect-4/3 w-full bg-surface-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={listing.title}
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              // The detail image is the largest thing on the page and above the
              // fold, so it is the Largest Contentful Paint element.
              priority
              className={[
                listing.category === "books" ? "object-contain" : "object-cover",
                isSold ? "grayscale" : "",
              ].join(" ")}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              No photo
            </div>
          )}
        </div>

        <div className="p-5">
          {isSold ? (
            <p
              role="status"
              className="mb-3 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm font-medium"
            >
              This item has been sold.
            </p>
          ) : null}

          <h1 className="text-xl font-semibold tracking-tight">{listing.title}</h1>

          <p className="mt-1 text-2xl font-semibold">{formatPrice(listing.price)}</p>

          {hint ? (
            <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${VERDICT_CLASS[hint.verdict]}`}>
              <span className="font-medium">Fair-price check: </span>
              {hint.message}
              <span className="mt-0.5 block text-xs opacity-80">
                Originally {formatPrice(listing.original_price ?? 0)} ·{" "}
                {CONDITION_LABELS[listing.condition].toLowerCase()} condition suggests around{" "}
                {formatPrice(hint.expected)}
              </span>
            </div>
          ) : null}

          <p className="mt-4 text-sm/relaxed whitespace-pre-line">{listing.description}</p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
            <Detail label="Category" value={CATEGORY_LABELS[listing.category]} />
            <Detail label="Condition" value={CONDITION_LABELS[listing.condition]} />
            <Detail label="Seller" value={listing.seller?.full_name ?? "A student"} />
            <Detail label="Pickup" value={listing.pickup_spot?.name ?? "To be arranged"} />
            {listing.course_code ? <Detail label="Course" value={listing.course_code} /> : null}
            {listing.semester ? <Detail label="Semester" value={`Semester ${listing.semester}`} /> : null}
            {listing.book_author ? <Detail label="Author" value={listing.book_author} /> : null}
            {listing.isbn ? <Detail label="ISBN" value={listing.isbn} /> : null}
          </dl>

          <ConditionSummary category={listing.category} checks={listing.condition_checks} />

          {isOwner ? (
            // Ownership decides only what is *shown* here. Each action re-checks
            // the session and scopes its query by seller_id, and RLS refuses the
            // row regardless - so hiding these controls is a convenience, never
            // the protection. See scripts/verify-rls.mjs.
            <OwnerActions listingId={listing.id} status={listing.status} />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
