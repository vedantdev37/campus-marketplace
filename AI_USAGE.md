# AI usage declaration

This project was built with AI assistance. This file discloses that assistance
in specific terms — the prompts given, the modules produced, and what the author
changed or verified — with an entry added after each phase of work.

**Tool:** Claude (Anthropic), via Claude Code, used interactively.

---

## How to read this

Each phase records three things:

1. **Asked for** — what the author requested, in their own words where possible.
2. **AI produced** — the specific files and modules generated or substantially
   written by AI.
3. **Author changed / verified** — what the author corrected, overruled, tested
   or confirmed themselves.

Section 3 is filled in by the author, not by the AI. Entries marked
_"pending author review"_ have not been reviewed yet and should not be treated
as verified.

---

## Phase 0 — Project and repository setup

**Asked for**

> "Campus Marketplace for my college club's (GDG NMIT) Round 2 full-stack
> challenge… Stack: Next.js (App Router, TypeScript, Tailwind), Supabase
> (Postgres, Auth, RLS, Storage, Realtime), zod validation, deployed on Vercel…
> Phase 0: help me set up the project and repo."

Plus, during the phase: *"I'll own and understand every line, explain key
decisions briefly as we go."*

**AI produced**

| File / module | What it is |
| --- | --- |
| *(whole project)* | Scaffolded via `create-next-app` (Next 16.4, App Router, TypeScript, Tailwind 4, `src/` layout) |
| `next.config.ts` | Removed the scaffold's `cacheComponents` / `partialPrefetching`; added `images.remotePatterns` for Supabase Storage and Google Books |
| `src/lib/env.ts` | zod 4 schema validating `NEXT_PUBLIC_*` variables at module load, with per-variable error messages |
| `.env.example` | Environment template, deliberately without a service-role key |
| `.gitignore` | Patched to negate `.env.example` (the scaffold's `.env*` rule would have excluded it from the repo) |
| `.gitattributes` | LF normalisation for Windows development |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | Metadata, placeholder landing page, and a fix for the scaffold overriding its own Geist font with Arial |
| `README.md`, `docs/architecture.md`, `AI_USAGE.md` | Documentation |

**AI reasoning worth noting.** Two issues were found by AI reading the Next.js
16 documentation bundled in `node_modules`, not from prior knowledge:

- Cache Components makes reading `cookies()` outside a `<Suspense>` boundary a
  *build-time* error, which would have collided with `@supabase/ssr` on Vercel
  rather than locally. It was disabled; reasoning in `docs/architecture.md`.
- `partialPrefetching` hard-requires `cacheComponents`, so the two had to be
  disabled together.

It also caught that the generated `.gitignore` would have silently excluded
`.env.example`, making the README's setup steps reference a file not present in
the repo.

**Author changed / verified**

- Chose the project location on disk and the repo hosting approach.
- Corrected the submission deadline and set the bonus-feature priority order.
- Added further requirements (campus email restriction, course code / semester,
  fair-price hint) to be designed into the Phase 1 schema.
- Confirmed that an AI claim about a prior project name ("Solvify") did not
  apply — AI verified by search that the string appeared nowhere in the project
  or its history, and made no changes.
- _Code review of the above files: **pending author review**._

---

## Phase 1a — Database schema, RLS and the sign-up gate

Logged separately from the auth UI (Phase 1b) because it is a self-contained
deliverable. **The SQL in this entry has been written but not yet executed**, so
nothing in it is verified behaviour.

**Asked for**

> "Phase 1: schema + RLS + auth"

and, mid-phase:

> "Additions to the design (plan for them in the schema now, build later):
> sign-up restricted to `@nmit.ac.in` emails; listings have an optional course
> code (e.g. '21CS32') and semester, both searchable; a fair-price hint from the
> Google Books original price combined with item condition."

**AI produced**

| File | What it is |
| --- | --- |
| `supabase/migrations/0001_schema.sql` | Enums, 5 tables, generated `tsvector` search column, indexes, `handle_new_user` and `listings_before_update` triggers |
| `supabase/migrations/0002_rls.sql` | Grants, RLS on every table, all policies, Realtime publication |
| `supabase/migrations/0003_storage.sql` | `listing-images` bucket and path-based ownership policies |
| `supabase/migrations/0004_signup_domain_allowlist.sql` | Allowlist table and the Before User Created hook function |
| `supabase/migrations/0005_seed.sql` | Pickup spots, allowed sign-up domains |
| `.env.local` | Written from credentials supplied by the author (not committed) |
| `README.md`, `docs/architecture.md` | Migration steps, dashboard settings, reviewer access, decision records |

**AI reasoning worth noting**

- Identified that restricting sign-up in application code would be **security
  theatre**: the publishable key lets anyone POST to `/auth/v1/signup` directly.
  Moved the check to a database-level auth hook.
- Fetched Supabase's official hook documentation rather than relying on recall,
  and found **two problems with their published example** — it is
  allow-by-default (an unlisted domain is admitted), and it compares
  `lower(domain)` against `lower($1)` where `domain` shadows the table's own
  column and `$1` is the `jsonb` event argument. Both corrected, both recorded
  in `docs/architecture.md`.
- Raised a conflict the author's requirements had not accounted for: sign-up is
  a graded requirement, but a reviewer has no `@nmit.ac.in` address and so could
  not test it. Surfaced three options rather than silently picking one.
- Verified the supplied Supabase credentials by calling the project's REST and
  auth endpoints, and correctly distinguished a `401` on the schema-root
  endpoint (expected — it requires a secret key) from an authentication
  failure, confirming via a `PGRST205` table-not-found response that the key
  works.
- Stated plainly that the SQL could not be validated locally (no Postgres or
  Docker on the machine, and it references Supabase-only objects) rather than
  implying it was tested.

**Author changed / verified**

- Supplied the Supabase project and credentials; created the GitHub repository.
- Chose the resolution for the reviewer-access conflict (enforced allowlist
  seeded with a documented test domain) and chose to disable email confirmation
  for the demo, accepting the stated trade-off.
- _Applying the migrations and confirming they execute: **pending**._
- _Code review of the SQL: **pending author review**._

---

## Phase 1b — Authentication

**Asked for**

> "Go with Phase 1b. Also: add a clear note at the top of the README that
> evaluators can sign up with any @reviewer.test email, and plan two seeded demo
> accounts (seller with listings, buyer) for testing owner-only actions."

**AI produced**

| File | What it is |
| --- | --- |
| `src/proxy.ts` | Session refresh and route gating |
| `src/lib/supabase/server.ts`, `browser.ts` | Per-request server client, browser client |
| `src/lib/auth.ts` | `getSessionUser` / `requireSessionUser` — the Data Access Layer |
| `src/lib/validation/auth.ts` | zod schemas shared by form and Server Action |
| `src/lib/navigation.ts` | Open-redirect-safe `?next=` handling |
| `src/app/(auth)/actions.ts` | `signUpAction`, `signInAction`, `signOutAction` |
| `src/app/(auth)/` | Route group, login and sign-up pages |
| `src/components/auth/` | Login and sign-up forms (client-side validation) |
| `src/components/ui/` | `TextField`, `SubmitButton`, `Alert` |
| `src/app/globals.css` | Design tokens, light and dark |
| `src/app/listings/` | Protected placeholder, `loading.tsx` skeleton |
| `src/app/error.tsx` | Route-level error boundary |
| `scripts/seed-demo.mjs` | Demo accounts and sample listings |

**AI reasoning worth noting**

Three issues came from reading the installed packages' own documentation rather
than from recall, and all three would have been silent failures:

1. **Next.js 16 renamed `middleware.ts` to `proxy.ts`** (and the exported
   function to `proxy`). Every Supabase guide still says `middleware.ts`. Such a
   file would simply never execute, and the only symptom would be users being
   logged out at random, because nothing would refresh their tokens. Found in
   the bundled Next 16 upgrade guide; confirmed afterwards by the build output
   listing `ƒ Proxy (Middleware)`.
2. **`@supabase/ssr` 0.12's `setAll` takes a second `headers` argument**
   carrying `Cache-Control: private, no-store`. Its own type documentation states
   that omitting it lets a CDN cache a response containing auth cookies and
   serve *one user's session token to a different user*. Vercel sits behind such
   a CDN. Most published examples call `setAll(cookiesToSet)` and drop it.
3. **`getClaims()` rather than `getUser()`** for session reads — local signature
   verification instead of a network call to the auth server on every render,
   with the trade-off stated rather than glossed over.

It also chose a single generic message for failed logins so registered campus
addresses cannot be enumerated, kept the password out of returned form state,
and validated the `?next=` parameter in two places (including the
protocol-relative `//host` and backslash forms) to avoid turning login into an
open redirect.

**Verified by testing** (not merely asserted): `next build`, `tsc --noEmit` and
`eslint` all clean; and against a running dev server — `/`, `/login`, `/signup`
return 200, `/listings` returns 307 to `/login?next=%2Flistings` while signed
out, `?next=https://evil.example` is rejected, and `?next=/listings` is
preserved.

**Not yet verified:** no sign-up has been performed against the real database,
because the migrations have not been applied. The domain gate, the profile
trigger and the seed script are all unexercised.

**Author changed / verified**

- Directed the phase and specified the reviewer-access and demo-account
  requirements.
- _Applying migrations and running the auth flow end to end: **pending**._
- _Code review of the above files: **pending author review**._

---

## Phase 2a — Browse, detail view and owner actions

Logged separately because creating and editing listings (Phase 2b) is not built
yet. **This entry covers read paths plus mark-sold and delete only.**

**Asked for**

> "Continue Phase 2 and stop at 10:50 with everything committed and pushed"

**AI produced**

| File | What it is |
| --- | --- |
| `src/lib/types/listing.ts` | Enums as const tuples, unions derived, display labels, condition value factors |
| `src/lib/validation/listing.ts` | zod schemas mirroring every database CHECK |
| `src/lib/listings.ts` | Read queries with filters and full-text search |
| `src/lib/listing-filters.ts` | URL search params → validated filters |
| `src/lib/pricing.ts` | Rupee formatting and the fair-price hint |
| `src/lib/storage.ts` | Public image URLs and upload paths |
| `src/components/listings/listing-card.tsx` | Grid card with the sold treatment |
| `src/components/listings/browse-filters.tsx` | Filter form (no JavaScript) |
| `src/components/listings/owner-actions.tsx` | Mark-sold and delete controls |
| `src/app/listings/page.tsx` | Browse, with two distinct empty states |
| `src/app/listings/[id]/page.tsx` | Detail view with the fair-price hint |
| `src/app/listings/mine/page.tsx` | My Listings, sold items in their own section |
| `src/app/listings/actions.ts` | Owner-only Server Actions |
| `scripts/verify-rls.mjs` | Adversarial RLS checks (9 assertions) |

**AI reasoning worth noting**

- **Found a bug that a green build hid.** `seller:profiles(full_name)` fails at
  runtime - PostgREST can reach `profiles` from `listings` by three paths
  (directly, and via `wishlist_items` and `inquiries`), so the embed is
  ambiguous. Both `next build` and `tsc` pass regardless, because the select
  string is opaque to them. Found only by running the query against the real
  database. An earlier code comment had asserted the join *was* unambiguous;
  that comment was wrong and was corrected.
- **A blocked write under RLS does not raise an error.** The row falls outside
  the policy, so zero rows match. Both the Server Actions and the verification
  script check the affected row count, not just the error - treating "no error"
  as success would report a refused operation as done, and would have made the
  RLS test suite pass vacuously.
- **Argued that application-level ownership checks are still worth having** even
  though RLS enforces ownership, because these actions run with the user's own
  token: omitting `.eq("seller_id", ...)` would make policy correctness, now and
  after every future migration, the only thing between a crafted request and
  another user's data.
- Chose a no-JavaScript GET form for filters, so a filtered view is shareable and
  the back button works, rather than rebuilding filtering client-side on top of
  the server-side filtering RLS already requires.
- Marked sold listings three ways at once (desaturated photo, dimmed card, SOLD
  pill) so the distinction does not depend on perceiving a contrast difference.

**Verified by testing**

- `next build`, `tsc --noEmit`, `eslint` clean.
- Against the live database: full-text search on a plain word, a course code and
  an author name all return rows; punctuation-only input returns zero rows
  without erroring (confirming the `websearch` parser choice); category filtering
  works; both joins resolve.
- `npm run verify:rls` - 9 of 9 assertions pass.
- `npm run seed:demo` and `npm run reseed:demo` both succeed, which also proves
  the migrations, the domain allowlist, the profile trigger and the `sold_at`
  trigger all work.

**Not verified**

- **No page has been opened in a browser.** Browse, detail, My Listings and the
  owner controls have never been rendered or clicked - only built and
  type-checked. Layout, the sold treatment and the mark-sold/delete round trip
  are all unconfirmed visually.
- Creating and editing listings, and image upload, are not implemented.

**Author changed / verified**

- Applied all five migrations, enabled the auth hook, disabled email
  confirmation.
- Required demo credentials be removed from the public repo, which prompted the
  rotation and the environment-variable approach.
- Deploying to Vercel, from their own account via the dashboard.
- _Visual and interaction testing of Phase 2a: **pending**._
- _Code review of the above files: **pending author review**._

---

## Deployment — first production release

**Asked for**

> "The app is live at https://nmit-campus-marketplace.vercel.app … Quickly verify the live URL (home, login,
> protected route redirect). Add the live URL to the README."

**Done by the author, not AI**

The Vercel project was created and deployed from the author's own Vercel account
through the dashboard, with GitHub connected so pushes to `main` auto-deploy.
Environment variables were set on Vercel, and the Supabase Site URL and Redirect
URLs were updated. The author confirmed on the live site that `@reviewer.test`
sign-up succeeds and `gmail.com` is refused.

AI was explicitly instructed not to use the Vercel connector for this project. An
earlier attempt to create the project through it had returned 403, and the
instruction stands regardless.

**Verified by AI against the live deployment**

- `/`, `/login`, `/signup` all return 200.
- `/listings` returns 307 to `/login?next=%2Flistings`, and `/listings/mine` to
  `/login?next=%2Flistings%2Fmine` — so `src/proxy.ts` is running in production,
  which is the thing most likely to have been silently broken by the Next 16
  `middleware` → `proxy` rename.
- `?next=https://evil.example` is rejected on the live site (no hidden input
  rendered) while `?next=/listings` is preserved, so the open-redirect guard
  holds in production and not only locally.
- The reviewer banner renders on the live home page.

**Not verified**

- The `Cache-Control: private, no-store` headers that `setAll` supplies are only
  emitted on a response that actually writes auth cookies, which an anonymous
  request does not trigger. The code path is implemented but has not been
  observed in production.
- No authenticated page has been rendered in a browser by AI. Browse, detail, My
  Listings and the mark-sold/delete round trip remain visually unconfirmed.

---

## Phase 2b — Creating and editing listings

_(Added when the phase completes.)_

---

## Honesty note

AI-generated code was not accepted unreviewed. Where a suggestion was wrong or a
poor fit it was changed or rejected — the Cache Components decision in
`docs/architecture.md` is an example of a scaffolded default being deliberately
overridden rather than left in place.

Any entry above still marked _"pending author review"_ is an honest statement
that the author has not yet personally verified that code.
