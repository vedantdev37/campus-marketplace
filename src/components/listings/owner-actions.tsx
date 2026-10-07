"use client";

import type { FormEvent } from "react";

import { deleteListingAction, setListingStatusAction } from "@/app/listings/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ListingStatus } from "@/lib/types/listing";

/**
 * Owner-only controls for a listing.
 *
 * A Client Component for one reason: the delete needs a confirmation step, and
 * `confirm()` only exists in the browser. Everything else here is a plain form
 * posting to a Server Action, so the mark-sold controls still work without JS -
 * only the confirmation prompt is lost, and the action re-checks ownership
 * regardless.
 */
export function OwnerActions({
  listingId,
  status,
}: {
  listingId: string;
  status: ListingStatus;
}) {
  const isSold = status === "sold";

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    // Deleting is irreversible and the button sits next to a benign one, so a
    // misclick should not destroy a listing.
    if (!window.confirm("Delete this listing? This cannot be undone.")) {
      event.preventDefault();
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-surface-muted p-4">
      <p className="text-sm font-medium">You own this listing</p>
      <p className="mt-0.5 text-xs text-muted">
        Only you can see these controls, and only you can perform them.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <form action={setListingStatusAction} className="flex-1">
          <input type="hidden" name="id" value={listingId} />
          <input type="hidden" name="status" value={isSold ? "available" : "sold"} />
          <SubmitButton pendingLabel={isSold ? "Relisting…" : "Marking sold…"}>
            {isSold ? "Mark as available" : "Mark as sold"}
          </SubmitButton>
        </form>

        <form action={deleteListingAction} onSubmit={confirmDelete} className="sm:w-auto">
          <input type="hidden" name="id" value={listingId} />
          <button
            type="submit"
            className="mt-1 w-full rounded-lg border border-danger/40 px-4 py-2.5 text-base font-medium text-danger transition-colors hover:bg-danger-surface sm:w-auto"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
