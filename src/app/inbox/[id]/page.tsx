import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatThread } from "@/components/chat/chat-thread";
import { MeetupBar } from "@/components/chat/meetup-bar";
import { ListingLiveRefresh } from "@/components/listings/listing-live-refresh";
import { requireSessionUser } from "@/lib/auth";
import { campusDate, campusDatePlusDays } from "@/lib/campus-time";
import { getActiveMeetup, getConversation, getMessages } from "@/lib/chat";
import { getPickupSpots } from "@/lib/listings";
import { formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import { MEETUP_MAX_DAYS_AHEAD } from "@/lib/types/chat";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Conversation · Nitte Mart",
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  // Null for a conversation between two other people, just as for an id that
  // does not exist: RLS returns no row either way.
  const conversation = await getConversation(id);

  if (!conversation || !conversation.listing) {
    notFound();
  }

  const [messages, meetup, spots] = await Promise.all([
    getMessages(id),
    getActiveMeetup(id),
    getPickupSpots(),
  ]);

  const { listing } = conversation;
  const iAmSeller = conversation.seller_id === user.id;
  const otherName =
    (iAmSeller ? conversation.buyer?.full_name : conversation.seller?.full_name) || "A student";
  const isSold = listing.status === "sold";
  const imageUrl = listingImageUrl(listing.image_path);

  const now = new Date();
  const isExpired = meetup?.status === "proposed" && new Date(meetup.meet_at) <= now;

  return (
    // Exactly the viewport minus the sticky header (56px, 80px from `md`, plus
    // its 1px bottom border), so the messages scroll inside it and the message
    // box stays at the bottom. Without the 1px the whole page scrolled by one.
    // `dvh` and not `vh`: on a phone it shrinks when the address bar shows.
    // `data-chat` is what hides the site footer on this page (globals.css): a
    // footer below a full-height chat would make the whole page scroll.
    <main data-chat className="flex h-[calc(100dvh-3.5rem-1px)] flex-col bg-canvas text-ink md:h-[calc(100dvh-5rem-1px)]">
      {/* If the listing is deleted while this is open, the page re-fetches and
          becomes the not-found page: the conversation went with it. */}
      <ListingLiveRefresh listingId={listing.id} />

      <div className="border-b border-hairline px-4 py-2 md:px-6">
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-3">
          <Link
            href="/inbox"
            aria-label="Back to inbox"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl hover:bg-surface-soft"
          >
            <span aria-hidden="true">←</span>
          </Link>

          <Link
            href={`/listings/${listing.id}`}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg"
          >
            <div className="relative size-12 shrink-0 overflow-hidden rounded-[14px] bg-surface-soft">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className={`object-cover ${isSold ? "grayscale" : ""}`}
                />
              ) : null}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{otherName}</h1>
              <p className="truncate text-sm text-ink-muted">
                {listing.title} ·{" "}
                <span className={isSold ? "line-through" : ""}>{formatPrice(listing.price)}</span>
                {isSold ? <span className="ml-1.5 font-semibold text-ink">Sold</span> : null}
              </p>
            </div>
          </Link>

          {isSold ? (
            <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[11px] leading-none font-semibold tracking-wide text-canvas uppercase">
              Sold
            </span>
          ) : null}
        </div>
      </div>

      {isSold ? (
        <p role="status" className="border-b border-hairline bg-surface-soft px-4 py-2 text-center text-sm text-ink-body md:px-6">
          This item has been sold. You can still message each other to arrange the handover.
        </p>
      ) : null}

      <MeetupBar
        conversationId={conversation.id}
        listingId={listing.id}
        myId={user.id}
        otherName={otherName}
        meetup={meetup}
        isExpired={Boolean(isExpired)}
        spots={spots.map((spot) => ({ id: spot.id, name: spot.name }))}
        defaultSpotId={listing.pickup_spot_id ?? spots[0]?.id ?? ""}
        minDate={campusDate(now)}
        maxDate={campusDatePlusDays(now, MEETUP_MAX_DAYS_AHEAD)}
        defaultDate={campusDatePlusDays(now, 1)}
      />

      <ChatThread
        conversationId={conversation.id}
        myId={user.id}
        otherName={otherName}
        messages={messages}
      />
    </main>
  );
}
