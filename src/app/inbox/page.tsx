import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { MessagesLiveRefresh } from "@/components/chat/messages-live-refresh";
import { UnreadPill } from "@/components/chat/unread";
import { requireSessionUser } from "@/lib/auth";
import { campusDate, formatCampusDay, formatCampusTime } from "@/lib/campus-time";
import { getInbox } from "@/lib/chat";
import { formatPrice } from "@/lib/pricing";
import { listingImageUrl } from "@/lib/storage";
import type { InboxRow } from "@/lib/types/chat";
import { isUuid } from "@/lib/uuid";

export const metadata: Metadata = {
  title: "Inbox · Campus Marketplace",
};

/** What the last thing said was, in one line. */
function preview(row: InboxRow, myId: string): string {
  const mine = row.last_message_sender === myId;

  switch (row.last_message_kind) {
    case "meetup_proposed":
      return mine ? "You proposed a meetup" : `${row.other_name} proposed a meetup`;
    case "meetup_accepted":
      return mine ? "You accepted the meetup" : `${row.other_name} accepted the meetup`;
    case "meetup_cancelled":
      return mine ? "You cancelled the meetup" : `${row.other_name} cancelled the meetup`;
    default:
      return `${mine ? "You: " : ""}${row.last_message_body ?? ""}`;
  }
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string | string[] }>;
}) {
  const user = await requireSessionUser();
  const { listing } = await searchParams;

  // `?listing=` narrows the inbox to one of my listings; it is how "3 chats"
  // on My Listings links here. Anything that is not a UUID is ignored.
  const listingId = isUuid(listing) ? listing : undefined;
  const rows = await getInbox(listingId);
  const today = campusDate(new Date());

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 bg-canvas px-4 py-6 text-ink md:px-6 md:py-8">
      <MessagesLiveRefresh />

      <h1 className="text-[26px] leading-tight font-semibold">Inbox</h1>

      {listingId ? (
        <p className="mt-2 text-base text-ink-body">
          {rows[0] ? `Conversations about “${rows[0].listing_title}”. ` : null}
          <Link href="/inbox" className="font-semibold text-ink underline">
            Show all conversations
          </Link>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-6 max-w-md">
          <h2 className="text-[22px] leading-tight font-semibold">No conversations yet</h2>
          <p className="mt-2 text-base text-ink-body">
            When you ask about an item, or someone asks about one of yours, the conversation
            appears here.
          </p>
          <Link
            href="/listings"
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-brand-fill px-6 text-base font-medium text-white hover:bg-brand-active"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <ul className="mt-4">
          {rows.map((row) => {
            const imageUrl = listingImageUrl(row.listing_image_path);
            const isSold = row.listing_status === "sold";
            const isUnread = row.unread_count > 0;
            const isToday = campusDate(new Date(row.last_message_at)) === today;

            return (
              <li key={row.conversation_id} className="border-b border-hairline">
                <Link
                  href={`/inbox/${row.conversation_id}`}
                  className="flex min-h-18 items-center gap-3 rounded-lg py-3 hover:bg-surface-soft"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-[14px] bg-surface-soft">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        sizes="56px"
                        className={`object-cover ${isSold ? "grayscale" : ""}`}
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className={`truncate text-base ${isUnread ? "font-bold" : "font-semibold"}`}>
                        {row.other_name}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-ink-muted">
                        {isToday
                          ? formatCampusTime(row.last_message_at)
                          : formatCampusDay(row.last_message_at)}
                      </span>
                    </p>

                    <p className="truncate text-sm text-ink-muted">
                      {/* Sold is said in words, as everywhere else. */}
                      {isSold ? <span className="font-semibold text-ink">Sold · </span> : null}
                      {row.listing_title} · {formatPrice(row.listing_price)}
                      {row.i_am_seller ? " · your listing" : ""}
                    </p>

                    <p className="flex items-center">
                      <span
                        className={`truncate text-sm ${isUnread ? "font-semibold text-ink" : "text-ink-body"}`}
                      >
                        {preview(row, user.id)}
                      </span>
                      <span className="ml-auto shrink-0">
                        <UnreadPill count={row.unread_count} />
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
