"use client";

import { useActionState } from "react";

import { startConversationAction, type AskSellerState } from "@/app/inbox/actions";
import { INPUT_CLASS } from "@/components/listings/form-field";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { MESSAGE_MAX_LENGTH } from "@/lib/types/chat";

const INITIAL_STATE: AskSellerState = {};

/**
 * "Ask about this item": the buyer's first message to the seller.
 *
 * The conversation is created together with this message, so a seller's inbox
 * never fills with empty threads from people who opened a chat and typed
 * nothing. On success the action redirects into the conversation.
 */
export function AskSeller({
  listingId,
  sellerName,
  action,
  opener,
}: {
  listingId: string;
  sellerName: string;
  /** The button's label for this kind of post: Ask seller, Rent it, I'm in... */
  action: string;
  /** What the message box starts with. The sender can change every word. */
  opener: string;
}) {
  const [state, submit] = useActionState(startConversationAction, INITIAL_STATE);
  const fieldError = state.fieldErrors?.body;

  return (
    <form action={submit} className="mt-4 rounded-[14px] border border-hairline p-6">
      <input type="hidden" name="listingId" value={listingId} />

      <label htmlFor="ask-body" className="text-base font-semibold text-ink">
        Message {sellerName}
      </label>

      <textarea
        id="ask-body"
        name="body"
        rows={3}
        required
        maxLength={MESSAGE_MAX_LENGTH}
        // React resets a form after its action runs. Handing back what was
        // typed means a failed send does not also throw the message away.
        defaultValue={state.body ?? opener}
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? "ask-body-error" : undefined}
        className={`${INPUT_CLASS} mt-3 resize-none ${fieldError ? "border-error" : "border-control-border"}`}
      />

      {fieldError ? (
        <p id="ask-body-error" role="alert" className="mt-1.5 text-xs font-medium text-error">
          {fieldError}
        </p>
      ) : null}

      {state.error ? (
        <div className="mt-3">
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}

      <div className="mt-3">
        <SubmitButton pendingLabel="Sending…">{action}</SubmitButton>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        This opens a private chat. Nothing is booked or paid for here: you agree the rest
        between you.
      </p>
    </form>
  );
}
