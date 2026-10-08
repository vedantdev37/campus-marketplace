"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";

import { sendMessageAction } from "@/app/inbox/actions";
import { CHAT_READ_EVENT } from "@/components/chat/unread";
import { INPUT_CLASS } from "@/components/listings/form-field";
import { formatCampusDateTime, formatCampusDay, formatCampusTime } from "@/lib/campus-time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MESSAGE_MAX_LENGTH, type Message } from "@/lib/types/chat";
import { useNewMessages } from "@/lib/use-new-messages";
import { messageBodySchema } from "@/lib/validation/chat";

type ChatThreadProps = {
  conversationId: string;
  myId: string;
  otherName: string;
  messages: Message[];
};

/** The counter appears once this much of the limit is used. */
const COUNTER_FROM = MESSAGE_MAX_LENGTH * 0.8;

/**
 * The messages of one conversation, and the box to write the next one.
 *
 * WHERE THE MESSAGES COME FROM
 * They are props: the server page queried them through RLS. When Realtime
 * says a message has arrived, this asks the router to re-render that page and
 * new props follow. Nothing from the realtime event is drawn on screen.
 *
 * READ STATE
 * Having the thread open and the tab visible counts as having read it. That is
 * recorded by calling `mark_conversation_read()` from here, not while the page
 * renders on the server: a GET that changes data would mark messages read for
 * a link that was only prefetched.
 */
export function ChatThread({ conversationId, myId, otherName, messages }: ChatThreadProps) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNearEndRef = useRef(true);

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [hasNewBelow, setHasNewBelow] = useState(false);

  const last = messages[messages.length - 1];
  const lastId = last?.id ?? null;
  const lastIsMine = last?.sender_id === myId;

  useNewMessages(() => router.refresh(), conversationId);

  // Watches a marker after the last message, so "is the reader at the end?" is
  // known without measuring on every scroll event.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const end = endRef.current;

    if (!scroller || !end) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isNearEndRef.current = entry.isIntersecting;

        if (entry.isIntersecting) {
          setHasNewBelow(false);
        }
      },
      { root: scroller, rootMargin: "0px 0px 120px 0px" },
    );

    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  // Start at the newest message, before the first paint.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;

    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, []);

  // A new message: follow it if the reader is at the end or wrote it. If they
  // have scrolled up to read something older, leave them there and offer a
  // way down instead of yanking the page.
  const followedIdRef = useRef(lastId);

  useEffect(() => {
    if (lastId === followedIdRef.current) {
      return;
    }

    followedIdRef.current = lastId;

    if (isNearEndRef.current || lastIsMine) {
      endRef.current?.scrollIntoView({ block: "end" });
    } else {
      setHasNewBelow(true);
    }
  }, [lastId, lastIsMine]);

  // Mark as read on open, and again whenever a message arrives while the tab
  // is actually being looked at.
  useEffect(() => {
    function markRead() {
      if (document.visibilityState !== "visible") {
        return;
      }

      void createSupabaseBrowserClient()
        .rpc("mark_conversation_read", { p_conversation_id: conversationId })
        .then(() => window.dispatchEvent(new Event(CHAT_READ_EVENT)));
    }

    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [conversationId, lastId]);

  function send() {
    const parsed = messageBodySchema.safeParse(body);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    setError(null);

    startSending(async () => {
      const result = await sendMessageAction({ conversationId, body: parsed.data });

      if (result.error) {
        // The text stays in the box, so a dropped connection costs a second
        // press of Send and not a retyped message.
        setError(result.error);
        return;
      }

      setBody("");
      inputRef.current?.focus();
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends and Shift+Enter makes a new line. Not while an IME is
    // composing, where Enter confirms a character rather than the message.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <>
      <div ref={scrollerRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 md:px-6">
        {/* role="log" makes a screen reader announce each new message as it is
            added, without re-reading the ones already there. */}
        <ol
          role="log"
          aria-label={`Conversation with ${otherName}`}
          className="mx-auto flex w-full max-w-[720px] flex-col gap-2 py-4"
        >
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const day = formatCampusDay(message.created_at);
            const showDay = !previous || formatCampusDay(previous.created_at) !== day;

            return (
              <li key={message.id} className="flex flex-col gap-2">
                {showDay ? (
                  <p className="py-2 text-center text-xs font-medium text-ink-muted">{day}</p>
                ) : null}

                <MessageItem message={message} isMine={message.sender_id === myId} otherName={otherName} />
              </li>
            );
          })}
        </ol>

        <div ref={endRef} aria-hidden="true" className="h-px" />

        {hasNewBelow ? (
          <div className="pointer-events-none sticky bottom-3 flex justify-center">
            <button
              type="button"
              onClick={() => endRef.current?.scrollIntoView({ block: "end" })}
              className="pointer-events-auto flex h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-canvas shadow-float"
            >
              New messages ↓
            </button>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        // The bottom padding keeps the box clear of the home indicator on a
        // phone with no physical button.
        className="border-t border-hairline bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6"
      >
        <div className="mx-auto w-full max-w-[720px]">
          {error ? (
            <p id="composer-error" role="alert" className="mb-2 text-sm font-medium text-error">
              {error}
            </p>
          ) : null}

          <div className="flex items-end gap-2">
            <label htmlFor="composer" className="sr-only">
              Message {otherName}
            </label>
            <textarea
              id="composer"
              ref={inputRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={`Message ${otherName}…`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "composer-error" : undefined}
              // Grows with its content up to a few lines, where the browser
              // supports it; a fixed single row otherwise.
              className={`${INPUT_CLASS} field-sizing-content max-h-36 min-h-12! resize-none border-control-border`}
            />
            <button
              type="submit"
              disabled={isSending || body.trim() === ""}
              aria-busy={isSending}
              className="flex h-12 shrink-0 items-center rounded-lg bg-brand-fill px-5 text-base font-medium text-white transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>

          {body.length >= COUNTER_FROM ? (
            <p className="mt-1 text-right text-xs text-ink-muted tabular-nums" aria-live="polite">
              {body.length} / {MESSAGE_MAX_LENGTH}
            </p>
          ) : null}
        </div>
      </form>
    </>
  );
}

const MEETUP_EVENT_LABEL = {
  meetup_accepted: "accepted the meetup",
  meetup_cancelled: "cancelled the meetup",
} as const;

/** How a proposal reads now, which may differ from when it was made. */
const PROPOSAL_STATUS = {
  proposed: "Waiting for a reply",
  accepted: "Accepted ✓",
  superseded: "Replaced by a later proposal",
  cancelled: "Cancelled",
} as const;

function MessageItem({
  message,
  isMine,
  otherName,
}: {
  message: Message;
  isMine: boolean;
  otherName: string;
}) {
  const who = isMine ? "You" : otherName;
  const time = formatCampusTime(message.created_at);

  if (message.kind === "meetup_proposed" && message.meetup) {
    const { meetup } = message;
    const isCurrent = meetup.status === "proposed" || meetup.status === "accepted";

    return (
      <div
        className={[
          "mx-auto w-full max-w-sm rounded-[14px] border border-hairline p-4 text-center text-sm",
          isCurrent ? "text-ink" : "text-ink-muted",
        ].join(" ")}
      >
        <p className="font-semibold">{who} proposed a meetup</p>
        <p className={isCurrent ? "mt-1" : "mt-1 line-through"}>
          {meetup.pickup_spot?.name ?? "The agreed spot"}, {formatCampusDateTime(meetup.meet_at)}
        </p>
        {/* The status is a word; the strike-through and the muted colour only
            repeat it. */}
        <p className="mt-1 font-medium">
          {/* A pending proposal reads differently to the person who has to
              answer it. */}
          {meetup.status === "proposed" && !isMine
            ? "Waiting for your reply"
            : PROPOSAL_STATUS[meetup.status]}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{time}</p>
      </div>
    );
  }

  if (message.kind === "meetup_accepted" || message.kind === "meetup_cancelled") {
    return (
      <p className="py-1 text-center text-sm text-ink-muted">
        {who} {MEETUP_EVENT_LABEL[message.kind]} · {time}
      </p>
    );
  }

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <p
        className={[
          "max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-base leading-snug break-words whitespace-pre-wrap md:max-w-[70%]",
          isMine ? "bg-ink text-canvas" : "bg-surface-soft text-ink",
        ].join(" ")}
      >
        <span className="sr-only">{who}: </span>
        {message.body}
      </p>
      <p className="mt-1 px-1 text-xs text-ink-muted">{time}</p>
    </div>
  );
}
