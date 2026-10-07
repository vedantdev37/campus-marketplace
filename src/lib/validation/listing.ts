import { z } from "zod";

import { CATEGORIES, CONDITIONS } from "@/lib/types/listing";

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
export const priceSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, { error: "Enter a price." }))
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { error: "Enter a price as a number." })
  .refine((value) => value >= 0, { error: "Price cannot be negative." })
  .refine((value) => value <= 1_000_000, { error: "That price is too high." })
  // Two decimal places, matching numeric(10,2) - otherwise Postgres rounds
  // silently and the stored price differs from what was typed.
  .refine((value) => Math.round(value * 100) === value * 100, {
    error: "Use at most 2 decimal places.",
  });

export const optionalPriceSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), {
    error: "Enter the original price as a number, or leave it blank.",
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

export const isbnSchema = optionalText(
  z.string().regex(/^[0-9Xx-]{10,17}$/, { error: "That does not look like an ISBN." }),
);

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
