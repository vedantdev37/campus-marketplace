import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types/listing";

/** A person, as other signed-in students see them. */
export type Profile = {
  id: string;
  full_name: string;
  bio: string | null;
  skills: string[];
  avatar_path: string | null;
  github_username: string | null;
};

const PROFILE_COLUMNS = "id, full_name, bio, skills, avatar_path, github_username";

/**
 * One profile, or null if there is no such user.
 *
 * Any signed-in student may read any profile (the policy in migration 0002):
 * a marketplace where you could not see who you are dealing with would be
 * worse, not safer. A signed-out visitor cannot - `anon` has no privilege on
 * the table at all - which is why profile pages sit behind sign-in.
 */
export async function getProfile(id: string): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the profile: ${error.message}`);
  }

  return (data as Profile) ?? null;
}

/** Someone's open posts, of every kind, newest first. */
export async function getOpenPostsBy(userId: string): Promise<Listing[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("listings")
    .select("*, seller:profiles!listings_seller_id_fkey(full_name), pickup_spot:pickup_spots(id, name)")
    .eq("seller_id", userId)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(24);

  if (error) {
    throw new Error(`Could not load posts: ${error.message}`);
  }

  return (data ?? []) as unknown as Listing[];
}

/** Two letters to stand in for a missing photo. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0]?.slice(0, 2) ?? "?");

  return letters.toUpperCase();
}
