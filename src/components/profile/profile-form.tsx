"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";

import { updateProfileAction, type ProfileFormState } from "@/app/me/actions";
import { Field, SECONDARY_BUTTON_CLASS } from "@/components/listings/form-field";
import { Alert } from "@/components/ui/alert";
import type { Profile } from "@/lib/profiles";
import {
  buildListingImagePath,
  LISTING_IMAGE_BUCKET,
  LISTING_IMAGE_TYPES,
  listingImageProblem,
  listingImageUrl,
} from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const INITIAL_STATE: ProfileFormState = {};

/**
 * Edit my profile: name, a short bio, skills, GitHub username and a photo.
 *
 * The photo is handled exactly as a listing's is: the browser uploads it
 * straight to Storage, into the user's own folder, and only the resulting path
 * goes to the Server Action. The Storage policy authorises the upload and the
 * action re-checks the path, so neither trusts the other.
 */
export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, submit] = useActionState(updateProfileAction, INITIAL_STATE);
  const [isSaving, startSaving] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const [avatarPath, setAvatarPath] = useState(profile.avatar_path ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shown = previewUrl ?? listingImageUrl(avatarPath || null);
  const isBusy = isUploading || isSaving;
  const errorFor = (field: string) => state.fieldErrors?.[field];

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const problem = listingImageProblem(file);

    if (problem) {
      setImageError(problem);
      event.currentTarget.value = "";
      return;
    }

    setImageError(null);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPendingFile(null);
    setPreviewUrl(null);
    setAvatarPath("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Intercepted because the upload has to finish before the action runs.
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    let pathToSave = avatarPath;

    if (pendingFile) {
      setIsUploading(true);

      const path = buildListingImagePath(profile.id, pendingFile.name);
      const { error } = await createSupabaseBrowserClient()
        .storage.from(LISTING_IMAGE_BUCKET)
        .upload(path, pendingFile, { contentType: pendingFile.type, cacheControl: "31536000", upsert: false });

      setIsUploading(false);

      if (error) {
        setImageError("The photo could not be uploaded. Check your connection and try again.");
        return;
      }

      pathToSave = path;
      setAvatarPath(path);
      setPendingFile(null);
    }

    formData.set("avatarPath", pathToSave);
    formData.delete("photo");

    startSaving(() => submit(formData));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {state.formError ? <Alert tone="error">{state.formError}</Alert> : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Photo (optional)</span>

        <div className="flex items-center gap-4">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-hairline bg-surface-soft">
            {shown ? (
              // A plain <img>: the preview may be a local blob: URL, which
              // next/image cannot optimise and would reject.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="Profile photo preview" width={96} height={96} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">No photo</div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="field-photo"
              className={`${SECONDARY_BUTTON_CLASS} w-fit cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink`}
            >
              {shown ? "Change photo" : "Add a photo"}
              <input
                ref={fileInputRef}
                id="field-photo"
                name="photo"
                type="file"
                accept={LISTING_IMAGE_TYPES.join(",")}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            {shown ? (
              <button
                type="button"
                onClick={removePhoto}
                className="flex min-h-11 w-fit items-center text-sm text-ink-muted underline hover:text-ink"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        {imageError ? (
          <p role="alert" className="text-xs font-medium text-error">
            {imageError}
          </p>
        ) : null}
      </div>

      <Field label="Name" name="fullName" error={errorFor("fullName")}>
        {(props) => (
          <input {...props} type="text" required maxLength={80} autoComplete="name" defaultValue={profile.full_name} />
        )}
      </Field>

      <Field label="About you (optional)" name="bio" error={errorFor("bio")} hint="Up to 280 characters.">
        {(props) => <textarea {...props} rows={3} maxLength={280} defaultValue={profile.bio ?? ""} />}
      </Field>

      <Field
        label="Skills (optional)"
        name="skills"
        error={errorFor("skills")}
        hint="Separate with commas, e.g. react, video editing, figma. Up to 12."
      >
        {(props) => (
          <input
            {...props}
            type="text"
            placeholder="e.g. react, supabase…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={profile.skills.join(", ")}
          />
        )}
      </Field>

      <Field
        label="GitHub username (optional)"
        name="github"
        error={errorFor("github")}
        hint="Just the username. A link to your GitHub profile is shown on your page."
      >
        {(props) => (
          <input
            {...props}
            type="text"
            maxLength={80}
            placeholder="e.g. vedantdev37…"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={profile.github_username ?? ""}
          />
        )}
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/me" className={SECONDARY_BUTTON_CLASS}>
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isBusy}
          aria-busy={isBusy}
          className="h-12 rounded-lg bg-accent px-6 text-base font-medium text-on-accent transition-colors hover:bg-accent-active disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted"
        >
          {isUploading ? "Uploading photo…" : isSaving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
