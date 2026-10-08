"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  createListingAction,
  updateListingAction,
  type ListingFormState,
} from "@/app/listings/actions";
import { Alert } from "@/components/ui/alert";
import {
  buildListingImagePath,
  LISTING_IMAGE_BUCKET,
  LISTING_IMAGE_TYPES,
  listingImageProblem,
  listingImageUrl,
} from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITIONS,
  CONDITION_LABELS,
  type ListingRow,
  type PickupSpot,
} from "@/lib/types/listing";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import {
  listingFieldSchemas,
  listingSchema,
  type ListingField,
} from "@/lib/validation/listing";

const INITIAL_STATE: ListingFormState = {};

/**
 * DESIGN.md `text-input`: white surface, 1px hairline, 8px radius, 56px tall.
 * On focus the border turns ink and thickens to 2px with no glow - done with an
 * inset shadow so the extra pixel does not shift the layout.
 */
const INPUT_CLASS =
  "min-h-14 w-full rounded-lg border bg-canvas px-3.5 py-3 text-base text-ink placeholder:text-ink-muted/70 focus:border-ink focus:shadow-[inset_0_0_0_1px_var(--ds-ink)] focus-visible:outline-none";

type ListingFormProps = {
  /** The signed-in user's id: the folder their photo is uploaded into. */
  userId: string;
  pickupSpots: PickupSpot[];
  /** Present when editing; absent when creating. */
  listing?: ListingRow;
};

/**
 * The one form used for both creating and editing a listing.
 *
 * Submitting happens in two steps, in this order:
 *
 *   1. If a new photo was chosen, the browser uploads it straight to Supabase
 *      Storage, into `<uid>/<random>.<ext>`.
 *   2. The text fields and the resulting path go to a Server Action.
 *
 * The photo does not travel through the Server Action because Next.js caps an
 * action's request body at 1 MB by default. Uploading from the browser also
 * means the Storage policy (first path segment must equal auth.uid()) is what
 * authorises the write, rather than server code acting on the user's behalf.
 *
 * Validation uses the same zod schemas as the action. This pass exists to give
 * an answer without a round trip; the action parses again because it cannot
 * assume the request came from this form.
 */
export function ListingForm({ userId, pickupSpots, listing }: ListingFormProps) {
  const isEdit = Boolean(listing);

  const [serverState, submitToServer] = useActionState(
    isEdit ? updateListingAction : createListingAction,
    INITIAL_STATE,
  );
  const [isSaving, startSaving] = useTransition();

  const [clientErrors, setClientErrors] = useState<Record<string, string | undefined>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [category, setCategory] = useState<string>(listing?.category ?? "");

  // --- Photo state ------------------------------------------------------
  // `imagePath` is what will be saved: the existing path, a freshly uploaded
  // one, or "" for no photo.
  const [imagePath, setImagePath] = useState<string>(listing?.image_path ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs hold the file in memory until revoked.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const shownImage = previewUrl ?? listingImageUrl(imagePath || null);
  const isBusy = isUploading || isSaving;

  /**
   * A field the user has touched since the last submit shows its live
   * client-side result, including "no error" - that is how a server error
   * disappears once the field is fixed. Otherwise the server's verdict stands.
   */
  const errorFor = (field: string) =>
    touched[field] ? clientErrors[field] : (clientErrors[field] ?? serverState.fieldErrors?.[field]);

  function validateOnBlur(field: ListingField, value: string) {
    const result = listingFieldSchemas[field].safeParse(value);

    setTouched((previous) => ({ ...previous, [field]: true }));
    setClientErrors((previous) => ({
      ...previous,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  }

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
    setImagePath("");
    setImageError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /** Uploads the chosen file and returns its path, or null on failure. */
  async function uploadPendingFile(file: File): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    const path = buildListingImagePath(userId, file.name);

    const { error } = await supabase.storage.from(LISTING_IMAGE_BUCKET).upload(path, file, {
      contentType: file.type,
      // The filename is random and never reused, so the file can be cached hard.
      cacheControl: "31536000",
      upsert: false,
    });

    if (error) {
      setImageError("The photo could not be uploaded. Check your connection and try again.");
      return null;
    }

    return path;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Always intercepted: the upload has to finish before the action runs, so
    // the action is invoked by hand below rather than by the browser.
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const text = (name: string) => String(formData.get(name) ?? "");

    const parsed = listingSchema.safeParse({
      title: text("title"),
      description: text("description"),
      price: text("price"),
      category: text("category"),
      condition: text("condition"),
      pickupSpotId: text("pickupSpotId"),
      courseCode: text("courseCode"),
      semester: text("semester"),
      isbn: text("isbn"),
      bookAuthor: text("bookAuthor"),
      originalPrice: text("originalPrice"),
    });

    if (!parsed.success) {
      const errors = fieldErrorsFrom(parsed.error);
      setClientErrors(errors);
      setTouched({});

      // Move focus to the first problem so it is not left off-screen.
      const firstInvalid = Object.keys(errors)[0];
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setClientErrors({});
    setTouched({});

    let pathToSave = imagePath;

    if (pendingFile) {
      setIsUploading(true);
      const uploadedPath = await uploadPendingFile(pendingFile);
      setIsUploading(false);

      if (!uploadedPath) {
        return;
      }

      // Remembered so a retry after a server-side error does not upload the
      // same file a second time.
      pathToSave = uploadedPath;
      setImagePath(uploadedPath);
      setPendingFile(null);
    }

    formData.set("imagePath", pathToSave);
    formData.delete("photo");

    startSaving(() => {
      submitToServer(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {listing ? <input type="hidden" name="id" value={listing.id} /> : null}

      {serverState.formError ? <Alert tone="error">{serverState.formError}</Alert> : null}

      {/* --- Photo ------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Photo</span>

        <div className="flex items-start gap-4">
          <div className="relative aspect-4/3 w-32 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface-soft">
            {shownImage ? (
              // A plain <img>: the preview is a local blob: URL, which next/image
              // cannot optimise and would reject.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownImage} alt="Listing photo preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                No photo
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="field-photo"
              className="w-fit cursor-pointer rounded-lg border border-ink bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft"
            >
              {shownImage ? "Change photo" : "Add a photo"}
            </label>
            <input
              ref={fileInputRef}
              id="field-photo"
              name="photo"
              type="file"
              accept={LISTING_IMAGE_TYPES.join(",")}
              onChange={handleFileChange}
              aria-describedby="field-photo-hint"
              className="sr-only"
            />

            {shownImage ? (
              <button
                type="button"
                onClick={removePhoto}
                className="w-fit text-sm text-ink-muted underline hover:text-ink"
              >
                Remove photo
              </button>
            ) : null}

            <p id="field-photo-hint" className="text-xs text-ink-muted">
              JPEG, PNG or WebP, up to 5 MB. Listings with a photo sell faster.
            </p>
          </div>
        </div>

        {imageError ? (
          <p role="alert" className="text-xs font-medium text-error">
            {imageError}
          </p>
        ) : null}
      </div>

      {/* --- Essentials ------------------------------------------------- */}
      <Field label="Title" name="title" error={errorFor("title")}>
        {(props) => (
          <input
            {...props}
            type="text"
            required
            maxLength={120}
            placeholder="e.g. Engineering Mathematics, 44th edition"
            defaultValue={listing?.title ?? ""}
            onBlur={(event) => validateOnBlur("title", event.currentTarget.value)}
          />
        )}
      </Field>

      <Field
        label="Description"
        name="description"
        error={errorFor("description")}
        hint="Condition details, what is included, why you are selling."
      >
        {(props) => (
          <textarea
            {...props}
            required
            rows={5}
            maxLength={2000}
            defaultValue={listing?.description ?? ""}
            onBlur={(event) => validateOnBlur("description", event.currentTarget.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Price (₹)" name="price" error={errorFor("price")}>
          {(props) => (
            <input
              {...props}
              type="text"
              inputMode="decimal"
              required
              placeholder="e.g. 350"
              defaultValue={listing ? String(listing.price) : ""}
              onBlur={(event) => validateOnBlur("price", event.currentTarget.value)}
            />
          )}
        </Field>

        <Field label="Pickup spot" name="pickupSpotId" error={errorFor("pickupSpotId")}>
          {(props) => (
            <select {...props} defaultValue={listing?.pickup_spot_id ?? ""}>
              <option value="">To be arranged</option>
              {pickupSpots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Category" name="category" error={errorFor("category")}>
          {(props) => (
            <select
              {...props}
              required
              value={category}
              onChange={(event) => setCategory(event.currentTarget.value)}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Condition" name="condition" error={errorFor("condition")}>
          {(props) => (
            <select {...props} required defaultValue={listing?.condition ?? ""}>
              <option value="" disabled>
                Choose a condition
              </option>
              {CONDITIONS.map((value) => (
                <option key={value} value={value}>
                  {CONDITION_LABELS[value]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {/* --- Course ----------------------------------------------------- */}
      <fieldset className="rounded-[14px] border border-hairline p-4">
        <legend className="px-1 text-sm font-medium text-ink">For a course? (optional)</legend>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Course code"
            name="courseCode"
            error={errorFor("courseCode")}
            hint="Lets classmates find it by code."
          >
            {(props) => (
              <input
                {...props}
                type="text"
                maxLength={12}
                autoCapitalize="characters"
                placeholder="e.g. 21CS32"
                defaultValue={listing?.course_code ?? ""}
                onBlur={(event) => validateOnBlur("courseCode", event.currentTarget.value)}
              />
            )}
          </Field>

          <Field label="Semester" name="semester" error={errorFor("semester")}>
            {(props) => (
              <select {...props} defaultValue={listing?.semester?.toString() ?? ""}>
                <option value="">Not specific</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                  <option key={semester} value={semester}>
                    Semester {semester}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </fieldset>

      {/* --- Book details ------------------------------------------------
          Always in the DOM so the values submit, but only opened by default
          for books, where they drive the fair-price hint. */}
      <details
        className="rounded-[14px] border border-hairline"
        open={category === "books" || Boolean(listing?.isbn || listing?.original_price)}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
          Book details (optional)
        </summary>

        <div className="grid grid-cols-1 gap-5 border-t border-hairline p-4 sm:grid-cols-2">
          <Field label="Author" name="bookAuthor" error={errorFor("bookAuthor")}>
            {(props) => (
              <input {...props} type="text" maxLength={160} defaultValue={listing?.book_author ?? ""} />
            )}
          </Field>

          <Field label="ISBN" name="isbn" error={errorFor("isbn")}>
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode="numeric"
                maxLength={17}
                defaultValue={listing?.isbn ?? ""}
                onBlur={(event) => validateOnBlur("isbn", event.currentTarget.value)}
              />
            )}
          </Field>

          <Field
            label="Original price (₹)"
            name="originalPrice"
            error={errorFor("originalPrice")}
            hint="Shows buyers how your price compares."
          >
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode="decimal"
                defaultValue={listing?.original_price != null ? String(listing.original_price) : ""}
                onBlur={(event) => validateOnBlur("originalPrice", event.currentTarget.value)}
              />
            )}
          </Field>
        </div>
      </details>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={listing ? `/listings/${listing.id}` : "/listings"}
          className="flex h-12 items-center justify-center rounded-lg border border-ink bg-canvas px-6 text-base font-medium text-ink hover:bg-surface-soft"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isBusy}
          aria-busy={isBusy}
          className="h-12 rounded-lg bg-brand px-6 text-base font-medium text-white transition-colors hover:bg-brand-active active:bg-brand-active disabled:cursor-not-allowed disabled:bg-brand-disabled"
        >
          {isUploading
            ? "Uploading photo…"
            : isSaving
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Publish listing"}
        </button>
      </div>
    </form>
  );
}

type FieldControlProps = {
  id: string;
  name: string;
  className: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

/**
 * Label, control, hint and error, wired together for assistive technology.
 *
 * The control is supplied as a render function so this works for <input>,
 * <textarea> and <select> alike: the wrapper computes the id and aria
 * attributes once and hands them over, rather than each control repeating them.
 */
function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>

      {children({
        id,
        name,
        className: `${INPUT_CLASS} ${error ? "border-error" : "border-hairline"}`,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
