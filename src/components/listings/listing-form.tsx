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
import type { BookAutofill } from "@/app/listings/book-actions";
import { BookLookup } from "@/components/listings/book-lookup";
import { Field, SECONDARY_BUTTON_CLASS } from "@/components/listings/form-field";
import { Alert } from "@/components/ui/alert";
import { fairPriceHint, formatPrice } from "@/lib/pricing";
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
  CONDITION_LABELS,
  CONDITION_VALUE_FACTOR,
  CONDITIONS,
  type ItemCondition,
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

const AUTOFILL_HINT = "Filled in from the ISBN. Edit it freely.";

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

  const formRef = useRef<HTMLFormElement>(null);

  const [clientErrors, setClientErrors] = useState<Record<string, string | undefined>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Controlled, because other parts of the form react to them as they change:
  // category reveals the book card, and the other three drive the price guide.
  const [category, setCategory] = useState<string>(listing?.category ?? "");
  const [condition, setCondition] = useState<string>(listing?.condition ?? "");
  const [price, setPrice] = useState<string>(listing ? String(listing.price) : "");
  const [originalPrice, setOriginalPrice] = useState<string>(
    listing?.original_price != null ? String(listing.original_price) : "",
  );

  /** Fields currently holding a value that came from a book lookup. */
  const [autofilled, setAutofilled] = useState<Record<string, boolean>>({});

  // --- Photo state ------------------------------------------------------
  // `imagePath` is what will be saved: the existing path, a freshly uploaded
  // one, an imported book cover, or "" for no photo.
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
  const isBook = category === "books";

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

  function clearAutofilled(field: string) {
    setAutofilled((previous) => (previous[field] ? { ...previous, [field]: false } : previous));
  }

  /**
   * Applies a book lookup to the form.
   *
   * Only EMPTY fields are filled. A seller who has already typed a title or a
   * description keeps it: a lookup is an offer of help, and silently replacing
   * someone's words with a database's is the opposite of help. Everything
   * filled stays an ordinary editable input.
   */
  function applyBook(book: BookAutofill) {
    const form = formRef.current;
    const filled: Record<string, boolean> = {};

    const fillIfEmpty = (name: string, value: string | null) => {
      const control = form?.elements.namedItem(name);

      if (
        value &&
        (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) &&
        control.value.trim() === ""
      ) {
        control.value = value;
        filled[name] = true;
      }
    };

    fillIfEmpty("title", book.title);
    fillIfEmpty("description", book.description);
    fillIfEmpty("bookAuthor", book.author);

    if (book.originalPriceInr !== null && originalPrice.trim() === "") {
      setOriginalPrice(String(book.originalPriceInr));
      filled.originalPrice = true;
    }

    // The cover is only used when the seller has not supplied their own photo.
    if (book.coverPath && imagePath === "" && !pendingFile) {
      setImagePath(book.coverPath);
    }

    setAutofilled((previous) => ({ ...previous, ...filled }));

    // Autofilled values are valid by construction, so stale errors on those
    // fields would now be wrong.
    setClientErrors((previous) => {
      const next = { ...previous };
      for (const name of Object.keys(filled)) {
        next[name] = undefined;
      }
      return next;
    });
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
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {listing ? <input type="hidden" name="id" value={listing.id} /> : null}

      {serverState.formError ? <Alert tone="error">{serverState.formError}</Alert> : null}

      {/* Category comes first because it decides what the rest of the form
          offers: choosing Books reveals the ISBN lookup, which can then fill in
          most of what follows. */}
      <Field label="What are you selling?" name="category" error={errorFor("category")}>
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

      {isBook ? (
        <BookLookup
          defaultIsbn={listing?.isbn ?? ""}
          defaultAuthor={listing?.book_author ?? ""}
          isbnError={errorFor("isbn")}
          authorError={errorFor("bookAuthor")}
          authorHint={autofilled.bookAuthor ? AUTOFILL_HINT : undefined}
          wantsCover={imagePath === "" && !pendingFile}
          onBook={applyBook}
          onAuthorEdited={() => clearAutofilled("bookAuthor")}
        />
      ) : null}

      {/* --- Photo ------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Photo</span>

        <div className="flex items-start gap-4">
          <div className="relative aspect-4/3 w-32 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface-soft">
            {shownImage ? (
              // A plain <img>: the preview may be a local blob: URL, which
              // next/image cannot optimise and would reject.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownImage} alt="Listing photo preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                No photo
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="field-photo" className={`${SECONDARY_BUTTON_CLASS} w-fit cursor-pointer`}>
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
                className="flex min-h-11 w-fit items-center text-sm text-ink-muted underline hover:text-ink"
              >
                Remove photo
              </button>
            ) : null}

            <p id="field-photo-hint" className="text-xs text-ink-muted">
              JPEG, PNG or WebP, up to 5 MB. A photo of your actual copy sells faster than a
              stock cover.
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
      <Field
        label="Title"
        name="title"
        error={errorFor("title")}
        hint={autofilled.title ? AUTOFILL_HINT : undefined}
      >
        {(props) => (
          <input
            {...props}
            type="text"
            required
            maxLength={120}
            placeholder="e.g. Engineering Mathematics, 44th edition"
            defaultValue={listing?.title ?? ""}
            onInput={() => clearAutofilled("title")}
            onBlur={(event) => validateOnBlur("title", event.currentTarget.value)}
          />
        )}
      </Field>

      <Field
        label="Description"
        name="description"
        error={errorFor("description")}
        hint={
          autofilled.description
            ? "Filled in from the ISBN. Add the condition of your copy."
            : "Condition details, what is included, why you are selling."
        }
      >
        {(props) => (
          <textarea
            {...props}
            required
            rows={5}
            maxLength={2000}
            defaultValue={listing?.description ?? ""}
            onInput={() => clearAutofilled("description")}
            onBlur={(event) => validateOnBlur("description", event.currentTarget.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Condition" name="condition" error={errorFor("condition")}>
          {(props) => (
            <select
              {...props}
              required
              value={condition}
              onChange={(event) => setCondition(event.currentTarget.value)}
            >
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

        <Field label="Your price (₹)" name="price" error={errorFor("price")}>
          {(props) => (
            <input
              {...props}
              type="text"
              inputMode="decimal"
              required
              placeholder="e.g. 350"
              value={price}
              onChange={(event) => setPrice(event.currentTarget.value)}
              onBlur={(event) => validateOnBlur("price", event.currentTarget.value)}
            />
          )}
        </Field>

        <Field
          label="Original price (₹)"
          name="originalPrice"
          error={errorFor("originalPrice")}
          hint={
            autofilled.originalPrice
              ? AUTOFILL_HINT
              : isBook
                ? "Optional. The MRP when new - printed on the back cover."
                : "Optional. What it cost new (the MRP)."
          }
        >
          {(props) => (
            <input
              {...props}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 650"
              value={originalPrice}
              onChange={(event) => {
                setOriginalPrice(event.currentTarget.value);
                clearAutofilled("originalPrice");
              }}
              onBlur={(event) => validateOnBlur("originalPrice", event.currentTarget.value)}
            />
          )}
        </Field>
      </div>

      <PriceGuide price={price} originalPrice={originalPrice} condition={condition} />

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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={listing ? `/listings/${listing.id}` : "/listings"} className={SECONDARY_BUTTON_CLASS}>
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

/** A positive finite number from a form string, or null. */
function toAmount(value: string): number | null {
  const trimmed = value.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const amount = Number(trimmed);
  return amount > 0 ? amount : null;
}

/**
 * Live pricing guidance while the seller fills in the form.
 *
 * The same `fairPriceHint` a buyer sees on the listing page, shown to the
 * seller before they publish - so the person who can act on "this is above the
 * usual price" finds out while they can still change it.
 *
 * Renders nothing until there is an original price and a condition to reason
 * from. A guide built on missing data would be a guess presented as advice.
 */
function PriceGuide({
  price,
  originalPrice,
  condition,
}: {
  price: string;
  originalPrice: string;
  condition: string;
}) {
  const original = toAmount(originalPrice);

  if (original === null || !(CONDITIONS as readonly string[]).includes(condition)) {
    return null;
  }

  const itemCondition = condition as ItemCondition;
  const expected = original * CONDITION_VALUE_FACTOR[itemCondition];
  const asking = toAmount(price);
  const hint = asking !== null ? fairPriceHint(asking, original, itemCondition) : null;

  const VERDICT_LABEL = { great: "A good deal", fair: "Fairly priced", high: "On the high side" };

  return (
    <div aria-live="polite" className="rounded-lg bg-surface-soft px-4 py-3 text-sm text-ink">
      <p className="font-semibold">
        {hint ? VERDICT_LABEL[hint.verdict] : "Price guide"}
        {hint ? <span className="font-normal"> — {hint.percentOfOriginal}% of the original price</span> : null}
      </p>
      <p className="mt-0.5 text-ink-body">
        Items in {CONDITION_LABELS[itemCondition].toLowerCase()} condition usually go for about{" "}
        {formatPrice(expected * 0.85)}–{formatPrice(expected * 1.15)}. Buyers see this comparison
        on your listing.
      </p>
    </div>
  );
}
