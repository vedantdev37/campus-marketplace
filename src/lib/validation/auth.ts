import { z } from "zod";

/**
 * Shared auth validation schemas.
 *
 * Defined once and used in two places: in the form for immediate feedback as
 * the user types, and again inside the Server Action before anything touches
 * the database. The client-side pass is a usability feature and nothing more -
 * a request can be crafted by hand, so it is never a security boundary.
 */

/**
 * Domains permitted to register.
 *
 * This list exists so the form can explain the rule *before* a round trip. It
 * is NOT the enforcement point: the real gate is the `signup_allowed_domains`
 * table plus the Before User Created auth hook, because the publishable key
 * lets anyone POST to /auth/v1/signup and bypass this file entirely.
 *
 * Keep it in step with `supabase/migrations/0005_seed.sql`. If they drift, the
 * consequence is a confusing message, not a hole.
 */
export const ALLOWED_SIGNUP_DOMAINS = ["nmit.ac.in", "reviewer.test"] as const;

const DOMAIN_MESSAGE =
  "Sign up with your campus email (@nmit.ac.in). Reviewers can use any @reviewer.test address.";

/** Trim and lower-case first, then validate - otherwise " A@B.com " is rejected for its spaces. */
const normalisedEmail = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email({ error: "Enter a valid email address." }));

export const campusEmailSchema = normalisedEmail.refine(
  (value) => ALLOWED_SIGNUP_DOMAINS.some((domain) => value.endsWith(`@${domain}`)),
  { error: DOMAIN_MESSAGE },
);

export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  // bcrypt silently ignores anything past 72 bytes, so a longer password would
  // give a false sense of strength. Reject it rather than truncate it.
  .max(72, { error: "Use at most 72 characters." });

export const fullNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(2, { error: "Enter your name." })
      .max(80, { error: "That name is too long." }),
  );

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: campusEmailSchema,
  password: passwordSchema,
});

/**
 * Login deliberately does not apply the domain rule or the length rule.
 * Existing accounts must keep working if the policy changes, and echoing the
 * password policy back on a failed login tells an attacker what to generate.
 */
export const loginSchema = z.object({
  email: normalisedEmail,
  password: z.string().min(1, { error: "Enter your password." }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Per-field schemas, so a form can validate one field on blur. */
export const authFieldSchemas = {
  fullName: fullNameSchema,
  email: campusEmailSchema,
  password: passwordSchema,
} as const;

export type AuthField = keyof typeof authFieldSchemas;

/**
 * First error per field, keyed by field name.
 *
 * Written against `error.issues` rather than a helper like `flatten()` so it
 * does not depend on which flattening API a given zod version exposes.
 */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key] = issue.message;
    }
  }

  return errors;
}
