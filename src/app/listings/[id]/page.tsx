import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AskSeller } from "@/components/chat/ask-seller";
import { MessagesLiveRefresh } from "@/components/chat/messages-live-refresh";
import { ConditionSummary } from "@/components/listings/condition-summary";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { OwnerActions } from "@/components/listings/owner-actions";
import { requireSessionUser } from "@/lib/auth";
import { formatCampusDateTime } from "@/lib/campus-time";
import { getInbox, getListingChat } from "@/lib/chat";
import { getListing } from "@/lib/listings";
import { fairPriceHint, formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/types/listing";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Listing · Nitte Mart",
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

  // Chat, as far as this viewer is concerned. RLS returns a buyer their own
  // conversation about this listing and its seller every one of them, so the
  // same query serves both - and a third person gets nothing, which is why an
  // accepted meetup is only ever shown to the two people who agreed it.
  const chat = await getListingChat(listing.id, user.id);
  const sellerName = listing.seller?.full_name || "the seller";
  const unread = isOwner
    ? (await getInbox(listing.id)).reduce((total, row) => total + row.unread_count, 0)
    : 0;

  const chatHref = chat.conversationIds[0] ? `/inbox/${chat.conversationIds[0]}` : null;

  // The facts a buyer scans for first, as chips under the title.
  const facts = [
    `${CONDITION_LABELS[listing.condition]} condition`,
    listing.course_code,
    listing.semester ? `Semester ${listing.semester}` : null,
    listing.pickup_spot ? `Pickup: ${listing.pickup_spot.name}` : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col bg-canvas text-ink">
      {/* Re-fetches this page when the listing changes, so a buyer looking at
          it sees it become sold without refreshing. */}
      <ListingLiveRefresh listingId={listing.id} />
      {/* And when a message arrives: accepting a meetup posts one, so the
          agreed time appears here for the other person without a refresh. */}
      <MessagesLiveRefresh />

      <div className="px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/listings"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline"
        >
          ← Back to browse
        </Link>

        {/* A product page: the photo takes the width it can, and the price
            and the actions sit in a column that stays in view from `md` up.
            One column on a phone, in reading order. */}
        <div className="mt-3 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_380px] md:gap-10">
          <div className="min-w-0">
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-[20px] bg-surface-soft">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={`Photo of ${listing.title}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 760px"
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
                // The status is announced by the price card's role="status";
                // this stamp is the same fact for the eye.
                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <span className="title-card -rotate-6 border-[3px] border-on-accent bg-accent px-5 pt-2 pb-1 text-[56px] text-on-accent md:text-[84px]">
                    Sold
                  </span>
                </span>
              ) : null}
            </div>

            <p className="mt-6 text-sm font-semibold tracking-[0.14em] text-indigo-text uppercase">
              {CATEGORY_LABELS[listing.category]}
            </p>
            <h1 className="mt-2 text-[28px] leading-tight font-extrabold md:text-[40px]">
              {listing.title}
            </h1>

            <ul aria-label="Key facts" className="mt-4 flex flex-wrap gap-2">
              {facts.map((fact) => (
                <li
                  key={fact}
                  className="rounded-full border border-control-border px-3.5 py-2 text-sm font-medium text-ink"
                >
                  {fact}
                </li>
              ))}
            </ul>

            <p className="mt-6 border-t border-hairline pt-6 text-base leading-relaxed whitespace-pre-line text-ink-body md:text-lg">
              {listing.description}
            </p>

            <ConditionSummary category={listing.category} checks={listing.condition_checks} />

            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-hairline pt-6 text-base">
              <Detail label="Seller" value={listing.seller?.full_name ?? "A student"} />
              <Detail label="Pickup" value={listing.pickup_spot?.name ?? "To be arranged"} />
              {listing.book_author ? <Detail label="Author" value={listing.book_author} /> : null}
              {listing.isbn ? <Detail label="ISBN" value={listing.isbn} /> : null}
            </dl>
          </div>

          <aside className="md:sticky md:top-28 md:self-start">
            <div className="rounded-[20px] border border-hairline p-6">
              {/* Always in the DOM so a screen reader announces the change when
                  the listing sells while the page is open. */}
              <p role="status" className={isSold ? "mb-3 text-base font-semibold" : "sr-only"}>
                {isSold ? "This item has been sold." : ""}
              </p>

              {/* The loudest thing on the page after the photo. Yellow on the
                  dark theme, ink on the light one, where yellow text would be
                  unreadable. */}
              <p className="text-[56px] leading-none font-extrabold tabular-nums">
                <span className={isSold ? "text-ink-muted line-through" : "text-price"}>
                  {formatPrice(listing.price)}
                </span>
              </p>

              {listing.original_price ? (
                <p className="mt-3 text-sm text-ink-muted">
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

              {chat.acceptedMeetups.length > 0 ? (
                // An agreed meetup replaces the generic "Meet at" line below:
                // showing both would give two different places to go.
                <ul className="mt-4 flex flex-col gap-2">
                  {chat.acceptedMeetups.map((meetup) => (
                    <li key={meetup.id} className="rounded-[14px] bg-success-surface p-4 text-sm">
                      <p className="font-semibold text-ink">
                        <span aria-hidden="true" className="mr-1.5">
                          ✓
                        </span>
                        Meetup: {meetup.spotName}, {formatCampusDateTime(meetup.meetAt)}
                      </p>
                      <p className="mt-1 text-ink-body">
                        Agreed with {meetup.withName}.{" "}
                        <Link
                          href={`/inbox/${meetup.conversationId}`}
                          className="font-semibold text-ink underline"
                        >
                          Open chat
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : isSold ? null : (
                <p className="mt-4 text-sm text-ink-body">
                  Meet at{" "}
                  <span className="font-semibold text-ink">
                    {listing.pickup_spot?.name ?? "a spot you agree with the seller"}
                  </span>
                  . Book the time in chat.
                </p>
              )}
            </div>

            {isOwner ? null : chatHref ? (
              <Link
                href={chatHref}
                className="mt-4 flex h-14 items-center justify-center rounded-lg bg-accent px-6 text-lg font-semibold text-on-accent hover:bg-accent-active"
              >
                Open chat with {sellerName}
              </Link>
            ) : isSold ? null : (
              <div id="ask">
                <AskSeller listingId={listing.id} sellerName={sellerName} />
              </div>
            )}

            {isOwner ? (
              // Ownership decides only what is *shown* here. Each action re-checks
              // the session and scopes its query by seller_id, and RLS refuses the
              // row regardless - so hiding these controls is a convenience, never
              // the protection. See scripts/verify-rls.mjs.
              <OwnerActions
                listingId={listing.id}
                status={listing.status}
                conversationCount={chat.conversationIds.length}
                unreadCount={unread}
              />
            ) : null}
          </aside>
        </div>
      </div>

      {/* On a phone the price and the way to act on it stay within reach while
          the description scrolls. `sticky`, not `fixed`: it rides the bottom of
          the screen only while this page's content is on it, and the site
          footer then scrolls into view beneath it instead of being covered. */}
      {!isOwner && (chatHref || !isSold) ? (
        <div className="sticky bottom-0 z-30 mt-auto border-t border-hairline bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="flex items-center gap-3">
            <p className="text-[22px] leading-none font-extrabold tabular-nums">
              <span className={isSold ? "text-ink-muted line-through" : "text-price"}>
                {formatPrice(listing.price)}
              </span>
            </p>
            <Link
              href={chatHref ?? "#ask"}
              className="ml-auto flex h-12 items-center justify-center rounded-lg bg-accent px-5 text-base font-semibold text-on-accent hover:bg-accent-active"
            >
              {chatHref ? "Open chat" : "Ask the seller"}
            </Link>
          </div>
        </div>
      ) : null}
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
