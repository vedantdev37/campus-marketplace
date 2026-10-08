"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTags } from "@/lib/validation/listing";

export type ProfileFormState = {
  formError?: string;
  fieldErrors?: Record<string, string>;
};

/** Must match the limits in migration 0010. */
const MAX_SKILLS = 12;
const GITHUB_USERNAME = /^[A-Za-z0-9-]{1,39}$/;

/**
 * Save my own profile.
 *
 * The row is chosen by the session, never by the form: there is no id field to
 * tamper with, and RLS would refuse another user's row regardless. What may be
 * written is limited twice more by the database - a column-level grant (only
 * these five columns) and CHECK constraints on each - so this validation is
 * for giving a useful message, not for holding the line.
 */
export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireSessionUser();
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const errors: Record<string, string> = {};

  const fullName = text("fullName");

  if (fullName.length < 2 || fullName.length > 80) {
    errors.fullName = "Enter your name, up to 80 characters.";
  }

  const bio = text("bio");

  if (bio.length > 280) {
    errors.bio = "Keep it under 280 characters.";
  }

  const skills = parseTags(text("skills"), MAX_SKILLS, "skill");

  if ("error" in skills) {
    errors.skills = skills.error;
  }

  // People paste the whole address. Take the username out of it.
  const github = text("github")
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");

  if (github && !GITHUB_USERNAME.test(github)) {
    errors.github = "Enter your GitHub username, like vedantdev37.";
  }

  // The photo was uploaded by the browser; what arrives is a path, which is a
  // string the client chose. Accept it only inside this user's own folder.
  const avatarPath = text("avatarPath");
  const [folder, fileName, ...rest] = avatarPath.split("/");
  const avatarOk =
    avatarPath === "" ||
    (folder === user.id && rest.length === 0 && /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(fileName ?? ""));

  if (!avatarOk) {
    return { formError: "That photo could not be attached. Please choose it again." };
  }

  if (Object.keys(errors).length > 0 || "error" in skills) {
    return { fieldErrors: errors };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      bio: bio || null,
      skills: skills.tags,
      github_username: github || null,
      avatar_path: avatarPath || null,
    })
    .eq("id", user.id)
    .select("id");

  // Zero rows with no error is how RLS says no.
  if (error || (data?.length ?? 0) === 0) {
    console.error("Could not update profile", { message: error?.message });
    return { formError: "Could not save your profile. Check your connection and try again." };
  }

  revalidatePath("/me");
  revalidatePath(`/u/${user.id}`);

  // redirect() throws, so it must come after the work and outside any try/catch.
  redirect(`/u/${user.id}`);
}
