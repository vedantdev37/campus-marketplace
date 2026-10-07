import { z } from "zod";

/**
 * Validated environment variables.
 *
 * Why this file exists: a missing Supabase key otherwise surfaces as a vague
 * "Invalid URL" or "fetch failed" deep inside the client library. Parsing at
 * module load turns that into one readable error naming the exact variable.
 *
 * Only NEXT_PUBLIC_* variables belong here. They are inlined into the browser
 * bundle at build time, which is why each one is referenced explicitly below:
 * Next.js replaces the literal `process.env.NEXT_PUBLIC_FOO` text, so
 * destructuring or dynamic lookup (`process.env[name]`) would break in the
 * browser. Server-only secrets are read in their own server modules instead,
 * so they can never be pulled into a client bundle through this import.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: "NEXT_PUBLIC_SUPABASE_URL must be a full URL, e.g. https://abcd.supabase.co",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, {
    error:
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Copy the publishable/anon key from Supabase -> Settings -> API.",
  }),
  NEXT_PUBLIC_SITE_URL: z
    .url({ error: "NEXT_PUBLIC_SITE_URL must be a full URL, e.g. http://localhost:3000" })
    .default("http://localhost:3000"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Invalid environment variables:\n${details}\n\n` +
      `Copy .env.example to .env.local and fill it in, then restart the dev server.\n` +
      `(Changes to .env.local are only picked up on restart.)`,
  );
}

export const env = parsed.data;
