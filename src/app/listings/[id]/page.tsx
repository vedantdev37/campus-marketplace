import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AskSeller } from "@/components/chat/ask-seller";
import { MessagesLiveRefresh } from "@/components/chat/messages-live-refresh";
import { ConditionSummary } from "@/components/listings/condition-summary";
import { TypeBadge } from "@/components/listings/listing-card";
import { SaveButton } from "@/components/listings/save-button";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { OwnerActions } from "@/components/listings/owner-actions";
import { requireSessionUser } from "@/lib/auth";
import { getInbox, getListingChat } from "@/lib/chat";
import { getListing } from "@/lib/listings";
import { formatCampusDateTime, formatCampusDay } from "@/lib/campus-time";
import { closedLabel, priceLine, TYPE_BADGE_CLASS } from "@/lib/listing-display";
import { dealMeter } from "@/lib/deal-meter";
import { formatPrice } from "@/lib/pricing";
import { getSavedIds } from "@/lib/wishlist";
import { listingImageUrl } from "@/lib/storage";
import { CATEGORY_LABELS, CONDITION_LABELS, TYPE_INFO } from "@/lib/types/listing";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Listing · Nitte Mart",
};

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
  const info = TYPE_INFO[listing.type];
  const closed = closedLabel(listing.type);
  const isSale = listing.type === "sale";
  const isSquad = listing.type === "skill_offer" || listing.type === "team_request";

  // The deal meter: null unless this is a sale with an MRP, or a free item.
  const deal = dealMeter({
    type: listing.type,
    price: listing.price,
    originalPrice: listing.original_price,
    condition: listing.condition,
    category: listing.category,
  });

  const isSaved = isOwner ? false : (await getSavedIds(user.id)).has(listing.id);

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
    info.isItem ? `${CONDITION_LABELS[listing.condition]} condition` : null,
    listing.found_on ? `Found ${formatCampusDay(`${listing.found_on}T12:00:00+05:30`)}` : null,
    listing.event_name,
    listing.event_date ? formatCampusDay(`${listing.event_date}T12:00:00+05:30`) : null,
    listing.course_code,
    listing.semester ? `Semester ${listing.semester}` : null,
    // A found item already says where in its headline; saying it again as a
    // chip put the same place on a phone screen three times.
    listing.pickup_spot && listing.type !== "lost_found" ? `Pickup: ${listing.pickup_spot.name}` : null,
    ...(isSquad ? listing.tags : []),
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col bg-canvas text-ink">
      {/* Re-fetches this page when the listing changes, so a buyer looking at
          it sees it become sold without refreshing. */}
      <ListingLiveRefresh listingId={listing.id} closedLabel={closed} />
      {/* And when a message arrives: accepting a meetup posts one, so the
          agreed time appears here for the other person without a refresh. */}
      <MessagesLiveRefresh />

      <div className="px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/explore"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline"
        >
          ← Back to Explore
        </Link>

        {/* A product page: the photo takes the width it can, and the price
            and the actions sit in a column that stays in view from `md` up.
            One column on a phone, in reading order. */}
        <div className="mt-3 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_380px] md:gap-10">
          <div className="min-w-0">
            <div
              className={[
                "relative w-full overflow-hidden rounded-[20px] bg-surface-soft",
                // A post with no photo gets a shallow band, not a large empty
                // frame where a picture would be.
                imageUrl ? "aspect-4/3" : "aspect-[3/1]",
              ].join(" ")}
            >
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
                // The kind of post, large, in its badge colour. The skills
                // are listed as chips just below, so they are not repeated.
                <div
                  aria-hidden="true"
                  className={[
                    "title-card flex h-full items-center justify-center text-[44px] text-white md:text-[72px]",
                    isSold ? "bg-[#6b6976]" : TYPE_BADGE_CLASS[listing.type],
                  ].join(" ")}
                >
                  {isSold ? null : info.badge}
                </div>
              )}

              {isSold ? (
                // The status is announced by the price card's role="status";
                // this stamp is the same fact for the eye.
                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <span
                    className={[
                      "title-card -rotate-6 border-[3px] px-5 pt-2 pb-1 text-center",
                      isSale
                        ? "border-on-accent bg-accent text-[56px] text-on-accent md:text-[84px]"
                        : "border-white bg-[#12111c] text-[36px] text-white md:text-[56px]",
                    ].join(" ")}
                  >
                    {closed}
                    {isSale ? (
                      <span className="block font-sans text-sm font-bold tracking-[0.14em] normal-case">
                        Mission passed
                      </span>
                    ) : null}
                  </span>
                </span>
              ) : null}
            </div>

            <p className="mt-6 flex items-center gap-3 text-sm font-semibold tracking-[0.14em] text-indigo-text uppercase">
              <TypeBadge type={listing.type} />
              {info.isItem ? CATEGORY_LABELS[listing.category] : null}
            </p>
            <h1 className="mt-2 text-[28px] leading-tight font-extrabold md:text-[40px]">
              {listing.title}
            </h1>

            {listing.type === "lost_found" ? (
              <p className="mt-4 rounded-lg bg-surface-soft px-4 py-3 text-sm text-ink-body">
                Posted by a student. This is not the college&rsquo;s official lost and found. If
                it is yours, say so in chat and describe something the photo does not show.
              </p>
            ) : null}

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
              <Detail
                label="Posted by"
                value={listing.seller?.full_name ?? "A student"}
                href={`/u/${listing.seller_id}`}
              />
              {isSquad ? null : (
                <Detail
                  label={listing.type === "lost_found" ? "Found at" : "Pickup"}
                  value={listing.pickup_spot?.name ?? "To be arranged"}
                />
              )}
              {listing.book_author ? <Detail label="Author" value={listing.book_author} /> : null}
              {listing.isbn ? <Detail label="ISBN" value={listing.isbn} /> : null}
            </dl>
          </div>

          <aside className="md:sticky md:top-28 md:self-start">
            <div className="rounded-[20px] border border-hairline p-6">
              {/* Always in the DOM so a screen reader announces the change when
                  the listing sells while the page is open. */}
              <p role="status" className={isSold ? "mb-3 text-base font-semibold" : "sr-only"}>
                {isSold ? `${closed}.` : ""}
              </p>

              {/* The loudest thing on the page after the photo. Yellow on the
                  dark theme, ink on the light one, where yellow text would be
                  unreadable. */}
              <p
                className={[
                  "leading-none font-extrabold tabular-nums",
                  // A price is a number and can be huge. "Found at Central
                  // Library" is a sentence and cannot.
                  info.hasPrice || listing.type === "free" ? "text-[56px]" : "text-[30px] leading-tight",
                ].join(" ")}
              >
                <span className={isSold ? "text-ink-muted line-through" : "text-price"}>
                  {priceLine(listing)}
                </span>
              </p>

              {listing.type === "rent" && listing.rent_max_days ? (
                <p className="mt-3 text-sm text-ink-muted">
                  For up to {listing.rent_max_days} {listing.rent_max_days === 1 ? "day" : "days"}.
                  Agree any deposit in chat.
                </p>
              ) : null}

              {listing.original_price ? (
                <p className="mt-3 text-sm text-ink-muted">
                  Originally {formatPrice(listing.original_price)}
                </p>
              ) : null}

              {deal ? (
                <div className="mt-4 rounded-[14px] bg-surface-soft p-4 text-sm">
                  {/* The verdict is a word, with a shape beside it. No red or
                      green: it reads the same in greyscale. */}
                  <p className="text-base font-bold">
                    <span aria-hidden="true" className="mr-1.5">
                      {deal.mark}
                    </span>
                    {deal.label}
                  </p>

                  {deal.reasoning ? (
                    <>
                      <p className="mt-1 text-ink-body">{deal.reasoning}</p>

                      <details className="mt-2">
                        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold underline">
                          How is this calculated?
                        </summary>
                        <div className="flex flex-col gap-1.5 pb-1 text-ink-body">
                          <p>
                            Fair price = MRP × a factor for condition × a factor for category.
                          </p>
                          <p>
                            Condition: new 0.90, like new 0.80, good 0.65, used 0.55, heavily used
                            0.35. Category: electronics 0.80; furniture, hostel gear and anything
                            else 0.90; books, notes and lab gear 1.00.
                          </p>
                          <p>
                            Asking up to 85% of fair is a steal, up to 115% is fair, up to 140% is
                            a bit high, and above that is overpriced.
                          </p>
                          <p className="text-xs text-ink-muted">
                            A rule of thumb, not a valuation: the factors are judgement, and the
                            MRP is what the seller or a book catalogue says it was.
                          </p>
                        </div>
                      </details>
                    </>
                  ) : (
                    <p className="mt-1 text-ink-body">It costs nothing. Go and get it.</p>
                  )}
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
              ) : isSold || isSquad ? null : (
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
                <AskSeller
                  listingId={listing.id}
                  sellerName={sellerName}
                  action={info.action}
                  opener={info.opener}
                />
              </div>
            )}

            {isOwner ? null : (
              <SaveButton
                listingId={listing.id}
                initialSaved={isSaved}
                variant="row"
                className="mt-3"
              />
            )}

            {isOwner ? (
              // Ownership decides only what is *shown* here. Each action re-checks
              // the session and scopes its query by seller_id, and RLS refuses the
              // row regardless - so hiding these controls is a convenience, never
              // the protection. See scripts/verify-rls.mjs.
              <OwnerActions
                listingId={listing.id}
                type={listing.type}
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
        <div
          // Tells the tab bar to stand down on this page (globals.css): two
          // bars stacked at the bottom of a phone leave little room to read.
          data-bottom-bar
          className="sticky bottom-0 z-30 mt-auto border-t border-hairline bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <div className="flex items-center gap-3">
            <p className="min-w-0 truncate text-[20px] leading-none font-extrabold tabular-nums">
              <span className={isSold ? "text-ink-muted line-through" : "text-price"}>
                {priceLine(listing)}
              </span>
            </p>
            <Link
              href={chatHref ?? "#ask"}
              className="ml-auto flex h-12 shrink-0 items-center justify-center rounded-lg bg-accent px-5 text-base font-semibold whitespace-nowrap text-on-accent hover:bg-accent-active"
            >
              {chatHref ? "Open chat" : info.action}
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Detail({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">
        {href ? (
          <Link href={href} className="inline-flex min-h-11 items-center underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
