"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

import {
  acceptMeetupAction,
  cancelMeetupAction,
  proposeMeetupAction,
} from "@/app/inbox/actions";
import { Field, SECONDARY_BUTTON_CLASS } from "@/components/listings/form-field";
import { Alert } from "@/components/ui/alert";
import { campusClock, campusDate, formatCampusDateTime, hourLabel } from "@/lib/campus-time";
import { MEETUP_FIRST_HOUR, MEETUP_LAST_HOUR, type Meetup } from "@/lib/types/chat";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import { meetupSchema } from "@/lib/validation/chat";

type MeetupBarProps = {
  conversationId: string;
  listingId: string;
  myId: string;
  otherName: string;
  /** The conversation's pending or accepted meetup, if it has one. */
  meetup: Meetup | null;
  /** A pending proposal whose time has gone by. Decided on the server. */
  isExpired: boolean;
  spots: { id: string; name: string }[];
  defaultSpotId: string;
  /** Campus dates (YYYY-MM-DD), computed on the server. */
  minDate: string;
  maxDate: string;
  defaultDate: string;
};

/** Every half hour from 8:00 am to 8:00 pm. */
const TIME_OPTIONS = Array.from(
  { length: (MEETUP_LAST_HOUR - MEETUP_FIRST_HOUR) * 2 + 1 },
  (_, index) => {
    const hour = MEETUP_FIRST_HOUR + Math.floor(index / 2);
    const minute = index % 2 === 0 ? 0 : 30;
    const value = hourLabel(hour, minute);
    const label = `${hour % 12 === 0 ? 12 : hour % 12}:${minute === 0 ? "00" : "30"} ${hour < 12 ? "am" : "pm"}`;

    return { value, label };
  },
);

const PRIMARY_BUTTON_CLASS =
  "flex h-11 items-center justify-center rounded-lg bg-brand-fill px-4 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted";

const SMALL_SECONDARY_CLASS = `${SECONDARY_BUTTON_CLASS} h-11! px-3! text-sm!`;

/**
 * The meetup for this conversation: its current state, and what you can do
 * about it.
 *
 * It sits above the messages, always in view, instead of living only on a
 * card somewhere up the thread: "where and when are we meeting?" is the one
 * thing both people need to find without scrolling. The thread still records
 * each proposal, acceptance and cancellation as it happened.
 *
 * Which buttons appear is a convenience. Accepting your own proposal, or one
 * in a conversation that is not yours, is refused by the database function
 * whatever this component renders.
 */
export function MeetupBar({
  conversationId,
  listingId,
  myId,
  otherName,
  meetup,
  isExpired,
  spots,
  defaultSpotId,
  minDate,
  maxDate,
  defaultDate,
}: MeetupBarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isMine = meetup?.proposed_by === myId;
  const isAccepted = meetup?.status === "accepted";
  const where = meetup ? `${meetup.pickup_spot?.name ?? "the agreed spot"}, ${formatCampusDateTime(meetup.meet_at)}` : "";

  // Changing a meetup starts from what is currently agreed, not from blank
  // defaults: usually only one of the three things is being changed. A date
  // that has already gone by, or a time that is not on the half hour, falls
  // back to the default.
  const currentDate = meetup ? campusDate(new Date(meetup.meet_at)) : "";
  const currentTime = meetup ? campusClock(meetup.meet_at) : "";
  const formDefaults = {
    spot: meetup?.pickup_spot_id ?? defaultSpotId,
    date: currentDate >= minDate ? currentDate : defaultDate,
    time: TIME_OPTIONS.some((option) => option.value === currentTime) ? currentTime : "16:00",
  };

  function openForm() {
    setFieldErrors({});
    setFormError(null);
    dialogRef.current?.showModal();
  }

  function run(action: typeof acceptMeetupAction) {
    if (!meetup) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await action({ meetupId: meetup.id, conversationId, listingId });
      setError(result.error ?? null);
    });
  }

  function cancel() {
    if (window.confirm(isAccepted ? "Cancel this meetup?" : "Withdraw this proposal?")) {
      run(cancelMeetupAction);
    }
  }

  function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const input = {
      pickupSpotId: String(form.get("pickupSpotId") ?? ""),
      date: String(form.get("date") ?? ""),
      time: String(form.get("time") ?? ""),
    };

    // The same schema the Server Action applies, run here first so a past time
    // is caught without a round trip. The action and the database repeat it.
    const parsed = meetupSchema().safeParse(input);

    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await proposeMeetupAction({ ...input, conversationId, listingId });

      if (result.fieldErrors || result.error) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error ?? null);
        return;
      }

      dialogRef.current?.close();

      // The button that opened the dialog may no longer exist ("Suggest
      // another time" becomes "Change"), so the browser has nowhere to return
      // focus to. Put it on the bar, which now shows the result.
      barRef.current?.focus();
    });
  }

  return (
    <section
      ref={barRef}
      tabIndex={-1}
      aria-label="Meetup"
      className={[
        "border-b border-hairline px-4 py-3 md:px-6",
        isAccepted ? "bg-success-surface" : "bg-canvas",
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56 text-sm">
          {!meetup ? (
            <p className="text-ink-body">No meetup arranged yet.</p>
          ) : isAccepted ? (
            <>
              <p className="font-semibold text-ink">
                <span aria-hidden="true" className="mr-1.5">
                  ✓
                </span>
                Meetup: {where}
              </p>
              <p className="text-ink-body">Agreed with {otherName}.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">
                {isMine ? "You proposed" : `${otherName} proposed`}: {where}
              </p>
              <p className="text-ink-body">
                {isExpired
                  ? "That time has passed. Suggest a new one."
                  : isMine
                    ? `Waiting for ${otherName} to reply.`
                    : "Accept it, or suggest another time."}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {meetup && !isAccepted && !isMine && !isExpired ? (
            <button
              type="button"
              onClick={() => run(acceptMeetupAction)}
              disabled={isPending}
              className={PRIMARY_BUTTON_CLASS}
            >
              Accept
            </button>
          ) : null}

          <button
            type="button"
            onClick={openForm}
            disabled={isPending}
            className={meetup ? SMALL_SECONDARY_CLASS : PRIMARY_BUTTON_CLASS}
          >
            {!meetup ? "Propose meetup" : isAccepted || isMine ? "Change" : "Suggest another time"}
          </button>

          {meetup ? (
            <button type="button" onClick={cancel} disabled={isPending} className={SMALL_SECONDARY_CLASS}>
              {isAccepted ? "Cancel meetup" : isMine ? "Withdraw" : "Decline"}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="basis-full">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
      </div>

      {/* A native <dialog>: showModal() traps focus, closes on Escape and
          returns focus to the button that opened it, with no code here. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="meetup-dialog-title"
        className="m-auto w-[min(calc(100%-2rem),420px)] rounded-[14px] bg-canvas p-6 text-ink shadow-float backdrop:bg-black/50"
      >
        {/* Keyed by the meetup, so the defaults follow it: an uncontrolled
            field reads `defaultValue` only when it is first mounted. */}
        <form
          key={meetup?.id ?? "new"}
          onSubmit={propose}
          noValidate
          className="flex flex-col gap-4"
        >
          <h2 id="meetup-dialog-title" className="text-[22px] leading-tight font-semibold">
            {meetup ? "Suggest a time and place" : "Propose a meetup"}
          </h2>

          <Field label="Pickup spot" name="pickupSpotId" error={fieldErrors.pickupSpotId}>
            {(props) => (
              <select {...props} defaultValue={formDefaults.spot}>
                {spots.map((spot) => (
                  <option key={spot.id} value={spot.id}>
                    {spot.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Date" name="date" error={fieldErrors.date}>
            {(props) => (
              <input {...props} type="date" min={minDate} max={maxDate} defaultValue={formDefaults.date} required />
            )}
          </Field>

          <Field
            label="Time"
            name="time"
            error={fieldErrors.time}
            hint="Campus time (IST), between 8 am and 8 pm."
          >
            {(props) => (
              <select {...props} defaultValue={formDefaults.time}>
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className={`${PRIMARY_BUTTON_CLASS} h-12! shrink-0 text-base! sm:flex-1`}
            >
              {isPending ? "Sending…" : "Send proposal"}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={`${SECONDARY_BUTTON_CLASS} shrink-0 sm:flex-1`}
            >
              Not now
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
