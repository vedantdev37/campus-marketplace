import { z } from "zod";

import { normalizeIsbn } from "@/lib/isbn";
import {
  CATEGORIES,
  CATEGORIES_WITH_SIZE,
  CONDITION_CHECKS,
  CONDITIONS,
  LAB_SIZES,
  type ConditionChecks,
  type ListingCategory,
} from "@/lib/types/listing";

/**
 * Listing validation, shared by the create/edit form and the Server Actions.
 *
 * Every rule here mirrors a CHECK constraint in
 * `supabase/migrations/0001_schema.sql`. That duplication is deliberate: the
 * database constraint is the guarantee, and this schema exists to turn a
 * violation into a message next to the right input instead of a 400 from
 * Postgres. If they ever disagree, the database wins and the user sees a
 * generic error - so they are kept in step.
 */

/**
 * Blank optional inputs arrive as "" from a form; treat that as absent.
 *
 * The generic is constrained to `ZodType<string, string>` - both output and
 * input - because `.pipe()` requires the next schema to accept a string. A bare
 * `ZodType<string>` leaves the input as `unknown` and will not compose.
 *
 * Trim, then accept either empty or the real rule, then map empty to null, so
 * an untouched field stores NULL rather than an empty string. That matters:
 * the database CHECK constraints are written as `x is null or <rule>`, and ""
 * would fail them.
 */
const optionalText = <T extends z.ZodType<string, string>>(schema: T) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.union([z.literal(""), schema]))
    .transform((value): string | null => (value === "" ? null : value));

export const listingTitleSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(3, { error: "Give it a title of at least 3 characters." })
      .max(120, { error: "Keep the title under 120 characters." }),
  );

export const listingDescriptionSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(10, { error: "Describe the item in at least 10 characters." })
      .max(2000, { error: "Keep the description under 2000 characters." }),
  );

/**
 * Prices arrive as strings from a form.
 *
 * `z.coerce.number()` is avoided on purpose: it turns "" into 0 and "abc" into
 * NaN, so an empty field would silently become a free item. This parses
 * explicitly and rejects anything that is not a finite number.
 */
const MAX_PRICE = 1_000_000;

/**
 * The shape of a money amount, checked on the TEXT before it becomes a number.
 *
 * The two-decimal rule used to be tested arithmetically, as
 * `Math.round(value * 100) === value * 100`. That rejected perfectly valid
 * prices: 19.99 * 100 is 1998.9999999999998 in floating point, so a seller
 * typing 19.99 was told to "use at most 2 decimal places". Counting the digits
 * in the string asks the question that was actually meant, and cannot be
 * confused by binary rounding.
 */
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;
const AT_MOST_TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

export const priceSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, { error: "Enter a price." }))
  .refine((value) => !value.startsWith("-"), { error: "Price cannot be negative." })
  .refine((value) => PLAIN_NUMBER.test(value), { error: "Enter a price as a number." })
  // Two decimal places, matching numeric(10,2) - otherwise Postgres rounds
  // silently and the stored price differs from what was typed.
  .refine((value) => AT_MOST_TWO_DECIMALS.test(value), { error: "Use at most 2 decimal places." })
  .transform((value) => Number(value))
  .refine((value) => value <= MAX_PRICE, { error: "That price is too high." });

/**
 * Same rules as the asking price, but blank is allowed and means "unknown".
 *
 * The upper bound matters here too: the column is numeric(10,2), so a value of
 * 100,000,000 or more overflows it and Postgres rejects the whole save with a
 * message the user cannot act on.
 */
export const optionalPriceSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === "" || PLAIN_NUMBER.test(value), {
    error: "Enter the original price as a number, or leave it blank.",
  })
  .refine((value) => value === "" || AT_MOST_TWO_DECIMALS.test(value), {
    error: "Use at most 2 decimal places.",
  })
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || value <= MAX_PRICE, {
    error: "That original price is too high.",
  });

export const courseCodeSchema = optionalText(
  z.string().regex(/^[A-Za-z0-9]{2,12}$/, {
    error: "Course codes are 2-12 letters and digits, e.g. 21CS32.",
  }),
);

export const semesterSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? null : Number(value)))
  .refine(
    (value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 8),
    { error: "Semester must be a whole number from 1 to 8." },
  );

/**
 * Blank, or a real ISBN - stored in its normalised form (digits, final X).
 *
 * Validated with the check digit rather than a character pattern. The earlier
 * pattern accepted "----------" and rejected an ISBN typed with spaces, which
 * is how they are printed on a back cover.
 */
export const isbnSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === "" || normalizeIsbn(value) !== null, {
    error: "That does not look like a valid ISBN. Check the digits.",
  })
  .transform((value) => (value === "" ? null : normalizeIsbn(value)));

export const listingSchema = z.object({
  title: listingTitleSchema,
  description: listingDescriptionSchema,
  price: priceSchema,
  category: z.enum(CATEGORIES, { error: "Pick a category." }),
  condition: z.enum(CONDITIONS, { error: "Pick a condition." }),
  pickupSpotId: optionalText(z.uuid({ error: "Pick a pickup spot from the list." })),
  courseCode: courseCodeSchema,
  semester: semesterSchema,
  isbn: isbnSchema,
  bookAuthor: optionalText(z.string().max(160, { error: "That author name is too long." })),
  originalPrice: optionalPriceSchema,
});

export type ListingInput = z.infer<typeof listingSchema>;

/**
 * The checklist a given category accepts.
 *
 * Built per category from CONDITION_CHECKS and made STRICT, so a key that
 * belongs to another category - or to no category at all - is a validation
 * error rather than something silently stored. A tick can only be the literal
 * `true`: there is no "false", so "not stated" cannot be mistaken for
 * "confirmed bad", and nothing but a known size can be a string.
 *
 * The same rule is enforced again by a trigger in the database (migration
 * 0006), because a signed-in user can insert through the REST API directly and
 * never run this code.
 */
export function conditionChecksSchemaFor(category: ListingCategory) {
  const shape: Record<string, z.ZodType> = {};

  for (const item of CONDITION_CHECKS[category] ?? []) {
    shape[item.key] = z.literal(true).optional();
  }

  if (CATEGORIES_WITH_SIZE.includes(category)) {
    shape.size = z.enum(LAB_SIZES).optional();
  }

  return z.strictObject(shape);
}

/**
 * Collects the checklist from a submitted form and validates it.
 *
 * Every `check_*` field is gathered - not just the ones this category expects -
 * precisely so that an unexpected one is seen by the strict schema and
 * rejected. Returns null when the submission is not acceptable.
 */
export function readConditionChecks(
  category: ListingCategory,
  formData: FormData,
): ConditionChecks | null {
  const candidate: Record<string, unknown> = {};

  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("check_") || typeof value !== "string" || value === "") {
      continue;
    }

    const key = name.slice("check_".length);
    candidate[key] = key === "size" ? value : value === "on" ? true : value;
  }

  const parsed = conditionChecksSchemaFor(category).safeParse(candidate);

  if (!parsed.success) {
    return null;
  }

  // Drop the `undefined` entries that optional keys leave behind.
  return Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  ) as ConditionChecks;
}

/** Per-field schemas, so the form can validate one field on blur. */
export const listingFieldSchemas = {
  title: listingTitleSchema,
  description: listingDescriptionSchema,
  price: priceSchema,
  courseCode: courseCodeSchema,
  semester: semesterSchema,
  isbn: isbnSchema,
  originalPrice: optionalPriceSchema,
} as const;

export type ListingField = keyof typeof listingFieldSchemas;
