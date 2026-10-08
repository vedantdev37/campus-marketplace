"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type SaveState = { saved: boolean; error?: string };

/**
 * Save a post, or remove it from saved.
 *
 * The row's `user_id` comes from the session, never from the caller, and RLS
 * (wishlist_insert_own, wishlist_delete_own) refuses any other value anyway:
 * nobody can add to or remove from someone else's saved list.
 */
export async function setSavedAction(input: { listingId: string; save: boolean }): Promise<SaveState> {
  const user = await requireSessionUser();

  if (!isUuid(input.listingId)) {
    return { saved: !input.save, error: "That post could not be found." };
  }

  const supabase = await createSupabaseServerClient();

  if (input.save) {
    // Saving something already saved is not an error: the composite primary
    // key makes the second insert a no-op.
    const { error } = await supabase
      .from("wishlist_items")
      .upsert(
        { user_id: user.id, listing_id: input.listingId },
        { onConflict: "user_id,listing_id", ignoreDuplicates: true },
      );

    if (error) {
      console.error("Could not save post", { message: error.message });
      return { saved: false, error: "Could not save that. Check your connection and try again." };
    }
  } else {
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", input.listingId);

    if (error) {
      console.error("Could not remove saved post", { message: error.message });
      return { saved: true, error: "Could not remove that. Check your connection and try again." };
    }
  }

  revalidatePath("/me");
  return { saved: input.save };
}
