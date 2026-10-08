"use client";

import Link from "next/link";
import { useActionState, type FormEvent } from "react";

import {
  deleteListingAction,
  setListingStatusAction,
  type OwnerActionState,
} from "@/app/listings/actions";
import { UnreadPill } from "@/components/chat/unread";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TYPE_INFO, type ListingStatus, type ListingType } from "@/lib/types/listing";

const INITIAL_STATE: OwnerActionState = {};

/**
 * Owner-only controls for a listing.
 *
 * A Client Component for two reasons: delete needs a confirmation step, and
 * `confirm()` only exists in the browser; and a failed action reports back
 * here, next to the button, instead of throwing the owner onto the error page.
 * The forms still post to Server Actions, which re-check ownership regardless.
 */
export function OwnerActions({
  listingId,
  type,
  status,
  conversationCount,
  unreadCount,
}: {
  listingId: string;
  /** Decides the wording: mark as sold, rented out, claimed, team full. */
  type: ListingType;
  status: ListingStatus;
  /** How many buyers have asked about this listing. */
  conversationCount: number;
  unreadCount: number;
}) {
  const isSold = status === "sold";
  const info = TYPE_INFO[type];

  const [statusState, submitStatus] = useActionState(setListingStatusAction, INITIAL_STATE);
  const [deleteState, submitDelete, isDeleting] = useActionState(
    deleteListingAction,
    INITIAL_STATE,
  );

  const error = statusState.error ?? deleteState.error;

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    // Deleting is irreversible and the button sits next to a benign one, so a
    // misclick should not destroy a listing. Its conversations are deleted
    // with it (ON DELETE CASCADE), for the buyers too, so the prompt says so.
    const question =
      conversationCount > 0
        ? "Delete this post? Its conversations and any meetup will be deleted too, for you and the people you were talking to. This cannot be undone."
        : "Delete this post? This cannot be undone.";

    if (!window.confirm(question)) {
      event.preventDefault();
    }
  }

  return (
    <div className="mt-4 rounded-[14px] border border-hairline p-6">
      <p className="text-base font-semibold text-ink">This is your post</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        Only you can see these controls, and only you can perform them.
      </p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : isSold ? (
        <div className="mt-3">
          <Alert tone="success">
            {type === "sale"
              ? "SAVED! Off your shelf, into someone’s bag."
              : `Marked: ${info.closed.toLowerCase()}. New messages about it are closed.`}
          </Alert>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {conversationCount > 0 ? (
          <Link
            href={`/inbox?listing=${listingId}`}
            className="flex h-12 items-center justify-center rounded-lg border border-ink px-6 text-base font-medium text-ink transition-colors hover:bg-surface-soft"
          >
            {conversationCount === 1 ? "1 conversation" : `${conversationCount} conversations`}
            <UnreadPill count={unreadCount} />
          </Link>
        ) : (
          <p className="text-sm text-ink-muted">Nobody has messaged you about this yet.</p>
        )}

        <Link
          href={`/listings/${listingId}/edit`}
          className="flex h-12 items-center justify-center rounded-lg border border-ink px-6 text-base font-medium text-ink transition-colors hover:bg-surface-soft"
        >
          Edit
        </Link>

        <form action={submitStatus}>
          <input type="hidden" name="id" value={listingId} />
          <input type="hidden" name="status" value={isSold ? "available" : "sold"} />
          <SubmitButton pendingLabel="Saving…">
            {isSold ? info.reopenVerb : info.closeVerb}
          </SubmitButton>
        </form>

        <form action={submitDelete} onSubmit={confirmDelete}>
          <input type="hidden" name="id" value={listingId} />
          <button
            type="submit"
            // Disabled while the delete is in flight, so a second click cannot
            // send a second request for a listing that is already going.
            disabled={isDeleting}
            aria-busy={isDeleting}
            className="h-12 w-full rounded-lg border border-error px-6 text-base font-medium text-error transition-colors hover:bg-error-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
    </div>
  );
}
