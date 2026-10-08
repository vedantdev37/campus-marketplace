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
import { ConditionChecklist } from "@/components/listings/condition-checklist";
import { Field, SECONDARY_BUTTON_CLASS } from "@/components/listings/form-field";
import { Alert } from "@/components/ui/alert";
import { dealMeter } from "@/lib/deal-meter";
import { formatPrice } from "@/lib/pricing";
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
  CONDITIONS,
  RENT_MAX_DAYS,
  TYPE_INFO,
  type ListingCategory,
  type ListingRow,
  type ListingType,
  type PickupSpot,
} from "@/lib/types/listing";
import { fieldErrorsFrom } from "@/lib/validation/auth";
import {
  listingFieldSchemas,
  listingSchema,
  readTypeExtras,
  type ListingField,
} from "@/lib/validation/listing";

const INITIAL_STATE: ListingFormState = {};

const AUTOFILL_HINT = "Filled in from the ISBN. Edit it freely.";

type ListingFormProps = {
  /** The signed-in user's id: the folder their photo is uploaded into. */
  userId: string;
  pickupSpots: PickupSpot[];
  /** Which of the six kinds of post this is. Fixed once the post exists. */
  type: ListingType;
  /** Today in campus time (YYYY-MM-DD), from the server, for the date inputs. */
  today: string;
  /** Present when editing; absent when creating. */
  listing?: ListingRow;
};

/** What the title box suggests, per kind of post. */
const TITLE_PLACEHOLDER: Record<ListingType, string> = {
  sale: "e.g. Casio FX-991EX calculator…",
  rent: "e.g. Mini drafter with case…",
  free: "e.g. First-year physics lab manual…",
  lost_found: "e.g. Black water bottle with stickers…",
  skill_offer: "e.g. I will edit your fest aftermovie…",
  team_request: "e.g. Need a backend dev for Saturday's hackathon…",
};

const DESCRIPTION_HINT: Record<ListingType, string> = {
  sale: "Condition details, what is included, why you are selling.",
  rent: "What is included, any deposit you expect, when it is free.",
  free: "What it is and what state it is in. Free things go fast.",
  lost_found:
    "Describe it enough to be recognised, but hold one detail back so the real owner can prove it is theirs.",
  skill_offer: "What you do, what you have done before, and how long it takes you.",
  team_request: "What you are building, who you already have, and who you still need.",
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
export function ListingForm({ userId, pickupSpots, type, today, listing }: ListingFormProps) {
  const isEdit = Boolean(listing);
  const info = TYPE_INFO[type];
  const isSale = type === "sale";
  const isSquad = type === "skill_offer" || type === "team_request";

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

  // Warn before a reload or tab close throws away a half-written listing. The
  // browser shows its own generic prompt; the text cannot be customised. It is
  // switched off while saving, or the successful redirect would trigger it.
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty || isSaving) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, isSaving]);

  const shownImage = previewUrl ?? listingImageUrl(imagePath || null);
  const isBusy = isUploading || isSaving;
  // A post about a physical thing must show it; a skill or a call for
  // teammates has nothing to photograph.
  const photoRequired = info.photoRequired && (!listing || Boolean(listing.image_path));
  const isBook = isSale && category === "books";

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

    // The same substitutions the Server Action makes for fields this kind of
    // post does not have, so the two passes agree.
    const parsed = listingSchema.safeParse({
      title: text("title"),
      description: text("description"),
      price: info.hasPrice ? text("price") : "0",
      category: info.isItem ? text("category") : "other",
      condition: info.isItem ? text("condition") : "good",
      pickupSpotId: text("pickupSpotId"),
      courseCode: text("courseCode"),
      semester: text("semester"),
      isbn: text("isbn"),
      bookAuthor: text("bookAuthor"),
      originalPrice: text("originalPrice"),
    });
    const typed = readTypeExtras(type, formData);

    if (!parsed.success || "fieldErrors" in typed) {
      const errors = {
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...("fieldErrors" in typed ? typed.fieldErrors : {}),
      };
      setClientErrors(errors);
      setTouched({});

      // Move focus to the first problem so it is not left off-screen.
      const firstInvalid = Object.keys(errors)[0];
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setClientErrors({});
    setTouched({});

    // A listing needs a photo. The one exception is an older listing that never
    // had one: editing its price should not suddenly demand a photo, so the
    // rule applies to new listings and to any listing that already has one.
    // The Server Action enforces the same rule.
    if (photoRequired && imagePath === "" && !pendingFile) {
      setImageError("Add a photo. People want to see what it is.");
      fileInputRef.current?.focus();
      return;
    }

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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onInput={() => setIsDirty(true)}
      noValidate
      className="flex flex-col gap-5"
    >
      {listing ? <input type="hidden" name="id" value={listing.id} /> : null}
      {/* Read by the create action only. An edit takes the type from the row. */}
      <input type="hidden" name="type" value={type} />

      {serverState.formError ? <Alert tone="error">{serverState.formError}</Alert> : null}

      {/* Category comes first because it decides what the rest of the form
          offers: choosing Books reveals the ISBN lookup, which can then fill in
          most of what follows. */}
      {info.isItem ? (
        <Field label="What is it?" name="category" error={errorFor("category")}>
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
      ) : null}

      {type === "lost_found" ? (
        <p className="rounded-lg bg-surface-soft px-4 py-3 text-sm text-ink-body">
          This is a student noticeboard, not the college&rsquo;s official lost and found. For
          ID cards, wallets, phones and anything valuable, hand it to the security office too.
        </p>
      ) : null}

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
        <span className="text-sm font-medium text-ink">
          Photo{photoRequired ? "" : " (optional)"}
        </span>

        <div className="flex items-start gap-4">
          <div className="relative aspect-4/3 w-32 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface-soft">
            {shownImage ? (
              // A plain <img>: the preview may be a local blob: URL, which
              // next/image cannot optimise and would reject.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownImage}
                alt="Listing photo preview"
                width={128}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                No photo
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            {/*
             * The real file input is visually hidden and this label is what you
             * see, so keyboard focus lands on something invisible. The input
             * sits INSIDE the label so the label can show the ring on its
             * behalf, with `has-[:focus-visible]`. As siblings, a keyboard user
             * tabbed to the photo control and saw nothing change.
             */}
            <label
              htmlFor="field-photo"
              className={`${SECONDARY_BUTTON_CLASS} w-fit cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink`}
            >
              {shownImage ? "Change photo" : "Add a photo"}
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
            </label>

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
              JPEG, PNG or WebP, up to 5 MB.
              {isSale ? " A photo of your actual copy sells faster than a stock cover." : ""}
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
            placeholder={TITLE_PLACEHOLDER[type]}
            autoComplete="off"
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
            : DESCRIPTION_HINT[type]
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
        {info.isItem ? (
          <>
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
          </>
        ) : null}

        {isSquad ? null : (
          <Field
            label={type === "lost_found" ? "Where you found it" : "Pickup spot"}
            name="pickupSpotId"
            error={errorFor("pickupSpotId")}
          >
            {(props) => (
              <select {...props} defaultValue={listing?.pickup_spot_id ?? ""}>
                <option value="">{type === "lost_found" ? "Somewhere else" : "To be arranged"}</option>
                {pickupSpots.map((spot) => (
                  <option key={spot.id} value={spot.id}>
                    {spot.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {type === "lost_found" ? (
          <Field label="When you found it" name="foundOn" error={errorFor("foundOn")}>
            {(props) => (
              <input {...props} type="date" required max={today} defaultValue={listing?.found_on ?? today} />
            )}
          </Field>
        ) : null}

        {type === "rent" ? (
          <Field
            label="Longest rental (days)"
            name="rentMaxDays"
            error={errorFor("rentMaxDays")}
            hint={`From 1 to ${RENT_MAX_DAYS} days.`}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                inputMode="numeric"
                required
                placeholder="e.g. 3…"
                autoComplete="off"
                defaultValue={listing?.rent_max_days?.toString() ?? ""}
              />
            )}
          </Field>
        ) : null}

        {info.hasPrice ? (
          <>
        <Field label={type === "rent" ? "Price per day (₹)" : "Your price (₹)"} name="price" error={errorFor("price")}>
          {(props) => (
            <input
              {...props}
              type="text"
              inputMode="decimal"
              required
              placeholder="e.g. 350…"
              autoComplete="off"
              value={price}
              onChange={(event) => setPrice(event.currentTarget.value)}
              onBlur={(event) => validateOnBlur("price", event.currentTarget.value)}
            />
          )}
        </Field>
          </>
        ) : null}

        {isSale ? (
          <>
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
              placeholder="e.g. 650…"
              autoComplete="off"
              value={originalPrice}
              onChange={(event) => {
                setOriginalPrice(event.currentTarget.value);
                clearAutofilled("originalPrice");
              }}
              onBlur={(event) => validateOnBlur("originalPrice", event.currentTarget.value)}
            />
          )}
        </Field>
          </>
        ) : null}
      </div>

      {isSquad ? (
        <>
          <Field
            label={type === "skill_offer" ? "Skills you offer" : "Skills you need"}
            name="tags"
            error={errorFor("tags")}
            hint="Separate with commas, e.g. react, video editing, figma. Up to 8."
          >
            {(props) => (
              <input
                {...props}
                type="text"
                required
                placeholder="e.g. react, supabase…"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                defaultValue={listing?.tags.join(", ") ?? ""}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="For an event? (optional)"
              name="eventName"
              error={errorFor("eventName")}
            >
              {(props) => (
                <input
                  {...props}
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Saturday's hackathon…"
                  autoComplete="off"
                  defaultValue={listing?.event_name ?? ""}
                />
              )}
            </Field>

            <Field label="Event date (optional)" name="eventDate" error={errorFor("eventDate")}>
              {(props) => (
                <input {...props} type="date" min={today} defaultValue={listing?.event_date ?? ""} />
              )}
            </Field>
          </div>
        </>
      ) : null}

      {isSale ? (
        <PriceGuide
          price={price}
          originalPrice={originalPrice}
          condition={condition}
          category={category}
        />
      ) : null}

      {/* Keyed by category: switching category remounts it, so ticks for one
          kind of item are never carried over to another. Saved ticks are only
          offered back while the category is still the one they were saved for. */}
      {info.isItem && (CATEGORIES as readonly string[]).includes(category) ? (
        <ConditionChecklist
          key={category}
          category={category as ListingCategory}
          defaults={listing?.category === category ? listing.condition_checks : undefined}
        />
      ) : null}

      {/* --- Course ----------------------------------------------------- */}
      {isSale ? (
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
                placeholder="e.g. 21CS32…"
                autoComplete="off"
                spellCheck={false}
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
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={listing ? `/listings/${listing.id}` : "/post"} className={SECONDARY_BUTTON_CLASS}>
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isBusy}
          aria-busy={isBusy}
          className="h-12 rounded-lg bg-accent px-6 text-base font-medium text-on-accent transition-colors hover:bg-accent-active disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted"
        >
          {isUploading
            ? "Uploading photo…"
            : isSaving
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Publish"}
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
 * The deal meter, live, while the seller types a price.
 *
 * It is the same `dealMeter` a buyer sees on the card and the listing page,
 * shown to the one person who can still do something about "Overpriced".
 *
 * Renders nothing until there is an MRP, a category and a condition to reason
 * from. A verdict built on missing data would be a guess presented as advice.
 */
function PriceGuide({
  price,
  originalPrice,
  condition,
  category,
}: {
  price: string;
  originalPrice: string;
  condition: string;
  category: string;
}) {
  const original = toAmount(originalPrice);
  const asking = toAmount(price);

  // With no asking price yet, the meter is run at the fair price itself: that
  // yields the fair figure to show as a starting point, and no verdict.
  const probe = dealMeter({
    type: "sale",
    price: asking ?? 0,
    originalPrice: original,
    condition,
    category,
  });

  if (!probe || probe.fair === null) {
    return null;
  }

  return (
    <div aria-live="polite" className="rounded-lg bg-surface-soft px-4 py-3 text-sm text-ink">
      {asking === null ? (
        <>
          <p className="font-semibold">Deal meter</p>
          <p className="mt-0.5 text-ink-body">
            A fair second-hand price for this is about {formatPrice(probe.fair)}. Type your price
            to see how it compares.
          </p>
        </>
      ) : (
        <>
          <p className="font-bold">
            <span aria-hidden="true" className="mr-1.5">
              {probe.mark}
            </span>
            {probe.label}
          </p>
          <p className="mt-0.5 text-ink-body">{probe.reasoning}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Buyers see this badge on your listing.</p>
        </>
      )}
    </div>
  );
}
