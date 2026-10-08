import type { ListingStatus, ListingType } from "@/lib/types/listing";

/**
 * Row shapes for chat and meetups (migration 0008), hand-written for the same
 * reason as the listing types: the unions below must match the database.
 */

/** Must match the `messages_kind_known` CHECK. */
export const MESSAGE_KINDS = [
  "text",
  "meetup_proposed",
  "meetup_accepted",
  "meetup_cancelled",
] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Must match the `meetup_status` enum. */
export type MeetupStatus = "proposed" | "accepted" | "superseded" | "cancelled";

/** Must match the `messages_body_len` CHECK. */
export const MESSAGE_MAX_LENGTH = 1000;

/**
 * Campus hours for a meetup, in campus time. Must match the
 * `meetups_campus_hours` CHECK and the horizon in `propose_meetup()`.
 */
export const MEETUP_FIRST_HOUR = 8;
export const MEETUP_LAST_HOUR = 20;
export const MEETUP_MAX_DAYS_AHEAD = 60;

export type Meetup = {
  id: string;
  conversation_id: string;
  proposed_by: string;
  pickup_spot_id: string;
  meet_at: string;
  status: MeetupStatus;
  pickup_spot: { name: string } | null;
};

export type Message = {
  id: string;
  sender_id: string;
  kind: MessageKind;
  body: string;
  created_at: string;
  /** Present on the three meetup kinds. */
  meetup: Meetup | null;
};

/** One conversation, with what its page header shows. */
export type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  listing: {
    id: string;
    title: string;
    price: number;
    type: ListingType;
    status: ListingStatus;
    image_path: string | null;
    pickup_spot_id: string | null;
  } | null;
  buyer: { full_name: string } | null;
  seller: { full_name: string } | null;
};

/** One row of the Inbox, as returned by the `my_inbox()` database function. */
export type InboxRow = {
  conversation_id: string;
  listing_id: string;
  listing_title: string;
  listing_price: number;
  listing_type: ListingType;
  listing_status: ListingStatus;
  listing_image_path: string | null;
  other_id: string;
  other_name: string;
  i_am_seller: boolean;
  last_message_body: string | null;
  last_message_kind: MessageKind | null;
  last_message_sender: string | null;
  last_message_at: string;
  unread_count: number;
};

/** An accepted meetup, as shown on the listing page. */
export type AcceptedMeetup = {
  id: string;
  conversationId: string;
  spotName: string;
  meetAt: string;
  /** The other person in that conversation. */
  withName: string;
};
