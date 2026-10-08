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

**Asked for**

> "build Phase 2b: create and edit listing with image upload, one shared form
> component, a 'Sell an item' nav link, the existing validation schemas on client
> and server, owner-only edit, Storage upload with the `<uid>/…` path convention,
> loading/error states. Then verify it with playwright-cli"

and, mid-phase:

> "Once DESIGN.md is installed, build all NEW pages and components in the
> DESIGN.md style from the start" … "run these as sub-agents. Each touches ONLY
> its listed files" (Agent A: `src/lib/books.ts`; Agent B: `docs/write-up.md`)
> … "Review both agents' work, commit each separately"

**AI produced (main session)**

| File | What it is |
| --- | --- |
| `src/app/listings/actions.ts` | `createListingAction`, `updateListingAction`, image-path check, Storage cleanup on edit and delete |
| `src/components/listings/listing-form.tsx` | The one form for create and edit, with direct-to-Storage upload |
| `src/components/listings/form-skeleton.tsx` | Loading state shared by both routes |
| `src/app/listings/new/`, `src/app/listings/[id]/edit/` | Pages and `loading.tsx` files |
| `src/lib/storage.ts` | Upload limits and the file check |
| `src/app/globals.css` | DESIGN.md tokens under new names; focus rule moved into `@layer base` |
| `src/app/(auth)/actions.ts` | Network failures no longer reported as a wrong password |
| Nav links in `listings/page.tsx`, `listings/mine/page.tsx`, `owner-actions.tsx` | "Sell an item" and "Edit" |
| `.claude/skills/`, `skills-lock.json`, `DESIGN.md` | Installed tooling and the design reference (not AI-written) |

**AI produced (sub-agents, each confined to one file, then reviewed)**

| File | Produced by | Review outcome |
| --- | --- | --- |
| `src/lib/books.ts` | Sub-agent A | Read in full and accepted unchanged. Its key finding (keyless requests are refused) was re-tested independently before being believed. |
| `docs/write-up.md` | Sub-agent B | Read in full; accepted as drafted, then updated in a separate commit where facts had changed since it was written. |

**AI reasoning worth noting**

- **Uploading from the browser, not through the Server Action.** Next caps an
  action's request body at 1 MB by default (checked in the bundled docs), below
  a phone photo. The action therefore receives only a path, which is a
  client-chosen string, so it is accepted only if it lies in the caller's own
  `<uid>/` folder.
- **A real bug found by watching a real failure.** When the connection to
  Supabase dropped mid-test, the login page said "Email or password is
  incorrect." for correct credentials. Fixed, and then confirmed fixed when the
  connection dropped again.
- **A wrong theory, recorded as wrong.** AI attributed intermittent 10-second
  failures in `next dev` to Node's 250 ms connection-attempt timeout and
  restarted with a longer one. The failures continued, so the theory was
  discarded rather than kept. The cause was not found; the failures did not
  occur in the production build.
- **Two test assertions were wrong, not the app.** Checks expecting HTTP 404
  failed with 200. The bundled Next docs confirm that a route with `loading.tsx`
  starts streaming with a 200 before `notFound()` runs. The assertions were
  changed to check what the user actually sees.
- **A defect caught only by looking.** A screenshot showed the old blue focus
  ring drawn on top of the new ink border. Unlayered CSS outranks every Tailwind
  utility, so `focus-visible:outline-none` could not turn it off.
- **Sub-agent B found documentation errors in earlier AI work**, including the
  live landing page advertising barcode scanning that does not exist, and the
  README overstating what `verify:rls` proves. Both were corrected.

**AI mistakes in this phase**

- Stopping the dev server's task did not stop the server itself, so one "restart"
  never happened and one test run hit a half-dead process. Roughly ten minutes
  were lost to failures caused by the test environment rather than the code.
- Back-to-back test runs overlapped on one browser page and corrupted each
  other's results, until the script was changed to persist its checklist.

**Verified by testing**

- `next build`, `tsc --noEmit`, `eslint` clean.
- 30 of 30 scripted browser checks against a local production build — the list
  is in `docs/write-up.md`, section 8. It covers create, edit, photo
  replacement and cleanup, mark sold, delete, and a second user being refused.
- Screenshots of the create form at 390 px and 1280 px were inspected.
- Test listings and uploaded test images were removed afterwards
  (`reseed:demo`, plus emptying the seller's Storage folder).

**Not verified**

- The flow has not been run on the deployed Vercel site, only locally.
- `src/lib/books.ts` has never received a successful live response; without an
  API key Google returns 429.
- The edit page, detail page and browse page were not screenshotted — only the
  create form was looked at.
- Dark mode: the new pages are white-canvas by design and were not checked
  against a dark OS theme next to the older pages.

**Author changed / verified**

- Cut scope to realtime sold updates as the only bonus; dropped wishlist,
  messaging and push.
- Chose the design reference and directed that new work follow it immediately.
- Directed the use of sub-agents and their file boundaries.
- _Clicking through create/edit on the live site: **pending**._
- _Code review of the above files: **pending author review**._

---

## How AI was organised from Phase 3 onward: a review team

From Phase 3 the author directed that AI work as a small team of sub-agents
around each phase, each limited to a report of under 200 words:

- **Before a phase, three read-only reviewers run in parallel.** A *Judge*
  (acting as a strict evaluator of this rubric: what stands out, what is marked
  down), an *Auditor* (security, RLS, client and server validation, edge cases,
  error states) and a *Designer* (UX and visual quality against `DESIGN.md`,
  mobile first). None may edit files. The main session merges their points into
  a short plan, shows it to the author, then builds.
- **After a phase, a QA agent** drives the real flows in a browser with
  `playwright-cli`, as seller and as buyer, at 390 px and desktop, with
  screenshots, and returns a pass/fail report. Failures are fixed before
  anything is committed.

The reviewers are AI reviewing AI, which has limits: they share blind spots, and
they read code rather than use the product. What they are good for is a second
reading with a different brief. They found real defects that the building
session had written and not noticed - listed under each phase below. Every
reviewer claim that changed a decision was checked before it was acted on.

---

## Phase 3 — ISBN lookup, barcode scan and the fair-price guide

**Asked for**

> "Phase 3: ISBN scan + Google Books + fair-price hint … Use `src/lib/books.ts`;
> the key stays server-side only … Camera barcode scan (BarcodeDetector where
> supported, with a library fallback) plus a manual ISBN input. On a match:
> autofill title, author, description and cover; store the original price; show
> the fair-price hint by condition. The seller can always edit autofilled
> fields. Clear loading, not-found, quota and error states. First confirm with
> curl that the key returns a real result."

and, mid-phase, after AI reported that Google returned nothing:

> "Good call on the fallback. Make sure it's documented in the write-up, and if
> neither source returns a price, let the seller type the original price (MRP)
> manually so the fair-price hint still works."

> "if both sources fail, show a friendly 'Book not found — fill the details
> yourself' state that keeps the scanned ISBN, so it looks intentional, not
> broken."

**AI produced**

| File | What it is |
| --- | --- |
| `src/lib/isbn.ts` | Normalisation and check-digit validation, shared by form, schema and lookup |
| `src/lib/books.ts` | Rewritten: Google Books first, Open Library fallback, description, composed summary |
| `src/app/listings/book-actions.ts` | `lookupBookAction`: session check, per-user throttle, INR-only price, cover import |
| `src/components/listings/barcode-scanner.tsx` | Camera sheet; native `BarcodeDetector` or a WebAssembly fallback |
| `src/components/listings/book-lookup.tsx` | The ISBN card and all of its states |
| `src/components/listings/form-field.tsx` | Field wrapper and shared control styles, extracted from the form |
| `src/components/listings/listing-form.tsx` | Category first, autofill into empty fields only, live price guide |
| `src/lib/validation/listing.ts` | Price rules rewritten; ISBN validated by check digit |

**The main finding of this phase, and it came from testing, not from design**

The brief said to confirm with `curl` first. Doing so showed that Google Books,
with a valid key, returned **zero results for all twelve well-known print ISBNs
tried**, while a title search on the same key worked and Open Library resolved
the same ISBNs. Built as specified, the feature would have told nearly every
seller "book not found". AI proposed and built a two-source lookup, and the
author approved it and asked for the manual MRP field. This is recorded in
`docs/write-up.md` section 6.

**What the reviewers found (AI reviewing AI)**

- *Auditor:* **an existing bug in the building session's own earlier code** -
  the price rule `Math.round(value * 100) === value * 100` rejects valid prices
  such as 19.99 because of floating-point rounding. Fixed. It also flagged that
  the ISBN pattern accepted ten hyphens, that the original price had no upper
  bound, and that a non-INR price must not land in a rupee field.
- *Judge:* that the API should drive a feature rather than only autofill - hence
  the live price guide in the form - and that the lookup must work by typing so
  a desktop reviewer can use it.
- *Designer:* category first, the ISBN card revealed by choosing Books, a
  full-screen scanner sheet, and neutral rather than red failure states.
- *QA agent:* all eight scenarios passed; it reported three minor defects (a
  books-only hint shown for electronics, a 28 px tap target, portrait covers
  cropped on cards), all fixed. It also caught a mistake in the test brief: an
  ISBN the main session had supplied as "non-existent" does exist.

**AI mistakes in this phase**

- The first lookup test failed because the test's own selector matched two
  elements; the app was fine. Time was spent establishing that.
- The description came back empty from Open Library on the first working run,
  which the plan had not anticipated; a composed catalogue line was added.

**Verified by testing** (production build, `playwright-cli`)

- Typed ISBN: found, with title, author, description and cover filled, and the
  cover stored under the seller's own Storage folder.
- **Camera scan:** Chromium was launched with a fake webcam showing a generated
  EAN-13 barcode. The scanner opened, read the ISBN, closed, released the
  camera, and the same autofill followed.
- QA agent, scenarios A-H at desktop and 390 px: lookup and price guide,
  autofill not overwriting typed text, invalid and unknown ISBNs, a non-book
  category, edit, mobile layout and tap-target sizes, buyer view, cleanup.
- `curl` against Google Books and Open Library directly, to establish the above.

**Not verified**

- The **native** `BarcodeDetector` path (Chrome on Android) and iOS Safari. The
  fake-webcam test exercised the WebAssembly fallback only. No real phone was
  used.
- The Google Books success path against a live response: in testing it never
  returned a match, so every successful lookup came from Open Library. The
  Google parsing code has only been run against mocked responses.
- Whether a list price is ever autofilled in practice. It was not, in any test.
- The lookup on the deployed site (the key on Vercel).
- Lookup behaviour when the network drops mid-request.

**Author changed / verified**

- Supplied the Google Books API key and set it on Vercel.
- Approved the fallback and asked for the manual MRP field and the neutral
  not-found state.
- Defined the review-team process described above.
- _Trying the scanner on a real phone: **pending**._
- _Code review of the above files: **pending author review**._

---

## Phase 4 — Realtime, the validation and states audit, condition checklists

**Asked for**

> "1. Realtime sold updates: marking a listing sold updates every open browse
> and detail page without refresh (Supabase Realtime). Verify with two
> playwright sessions. 2. Validation/states audit: every form and page has
> client + server validation and loading/empty/error states. Fix gaps. 3. …
> category-specific condition checklists (electronics: charger included /
> battery OK / screen scratches; lab coat: size, stains; books: highlighting,
> missing pages), shown as ticks on the detail page. 4. Re-run
> `npm run verify:rls`; it must still pass."

and, after AI raised two questions:

> "Make the photo required on create … Editing can keep the existing photo.
> Keep 'Lab coats & gear' as its own category. … update the reseed script so
> every demo listing has a realistic image (simple generated placeholder images
> per category are fine)."

**AI produced**

| File | What it is |
| --- | --- |
| `supabase/migrations/0006_condition_checks.sql` | `condition_checks` column, `lab` category, validating trigger, two extra constraints |
| `src/lib/use-listing-changes.ts` | Realtime subscription hook |
| `src/components/listings/live-listing-grid.tsx`, `listing-live-refresh.tsx` | Live browse grid; re-fetch for detail and My Listings |
| `src/components/listings/condition-checklist.tsx`, `condition-summary.tsx` | Checklist inputs; the "Seller confirms" list |
| `src/lib/uuid.ts` | Real UUID check |
| `src/app/not-found.tsx`, `listings/[id]/not-found.tsx`, `global-error.tsx`, three `loading.tsx` | Missing states |
| `src/app/listings/actions.ts`, `owner-actions.tsx` | Checklist and photo rules; failures returned instead of thrown |
| `scripts/demo-images.mjs`, `seed-demo.mjs`, `verify-rls.mjs` | Drawn placeholder photos; three new attack assertions |

**What the reviewers found (AI reviewing AI)**

- *Auditor:* mark-sold and delete **threw** on failure, landing the owner on
  the error page; the id check accepted 36 hyphens and produced a **500**;
  there was no `not-found` or `global-error`; the search query was unbounded;
  sign-up could show a raw error message. It also said the checklist must be
  enforced **in SQL**, because a signed-in user can insert their own row through
  the API without running any app code - which is why the trigger exists.
- *Judge:* a sold card should grey out in place rather than vanish, and a photo
  being optional contradicts the brief. The second became a question to the
  author rather than a silent change.
- *Designer:* every checklist item should be a positive claim, so unticked can
  mean "not stated"; no red crosses.
- *QA agent:* nine scenarios passed. It found one real bug: **listing order
  reshuffled after a status change**, because rows seeded together share a
  `created_at` and nothing broke the tie. Fixed with a second sort key.

**AI mistakes in this phase**

- The first reseed failed: in a bulk insert, a key missing from some rows is
  sent as `null` rather than left to the column default, which the new
  `not null` column rejected. Caught immediately by running it.
- AI built the phase before the migration it depended on had been applied, then
  had to hold all commits until the author ran it. Pushing earlier would have
  broken create and edit on the live site.

**Verified by testing** (production build)

- Realtime, with two separate browser sessions: the buyer's browse card and
  open listing page both showed the sale, and a marker set on `window`
  beforehand survived, showing neither page reloaded.
- The trigger: seven crafted inserts through the API were all rejected.
- `npm run verify:rls`: 12 of 12, three of them new.
- QA agent, scenarios A-I, at desktop and 390 px.

**Not verified**

- Realtime on the deployed site, and with more than two clients.
- What happens to an open page if the realtime connection drops and resumes.
- The checklist and photo rules on a real phone.

**Author changed / verified**

- Applied migration 0006.
- Decided that a photo is required on create, that lab coats get their own
  category, and that demo listings need images.
- _Code review of the above files: **pending author review**._

---

## Phase 5 — Design pass

**Asked for**

> "1. Run the Judge/Designer reviewers first, focused on visual quality and
> 'does this feel like a real product, not a generic AI site'. 2. Apply
> DESIGN.md (airbnb) to every page … Keep all functionality identical. SOLD
> listings must stay clearly distinguishable. Fix dark mode so every page is
> consistent. 3. The homepage should feel alive and campus-specific: a clear
> headline, a search bar up front, recent listings, and the trust signals …
> 4. Leave a slot for a GTA-IV-style hero: wide campus photos slowly panning
> sideways and crossfading, with a dark gradient overlay, respecting reduced
> motion, using compressed WebP. Build it with placeholder images … 5. QA with
> playwright-cli screenshots of every page at 390px and desktop, in light and
> dark. Then run the web-design-guidelines skill and fix every accessibility
> and focus issue."

**AI produced**

| File | What it is |
| --- | --- |
| `src/app/globals.css` | One token system with dark values; old names kept as aliases |
| `src/app/layout.tsx` | Typeface, shared header, skip link, theme colour |
| `src/components/layout/` | `SiteHeader`, `NavLink`, `MobileMenu` |
| `src/app/page.tsx` | Rebuilt home: hero, search, recent listings, trust signals |
| `src/components/home/hero-slideshow.tsx`, `src/lib/hero-images.ts` | The hero and its build-time image list |
| `public/hero/` + `scripts/make-hero-placeholders.mjs` | Three generated placeholder images and instructions for replacing them |
| `supabase/migrations/0007_listing_teasers.sql` | Narrow function so the public home page can show recent listings |
| `listing-card.tsx`, `listings/[id]/page.tsx`, `owner-actions.tsx`, `browse-filters.tsx`, auth pages, forms | Restyled |

**What the reviewers found (AI reviewing AI)**

- *Judge:* the app had **two colour systems** and no shared header; the home
  page was a centred title and two buttons; and the string "NMIT" appeared
  nowhere in the source.
- *Designer:* that `DESIGN.md` itself **fails WCAG AA** for button text (white on
  `#ff385c` is about 3.5:1) and for input borders, with replacement values; a
  dark palette; and which components would break when ink and canvas swap.
- *QA agent:* 60 screenshots across 14 pages, two widths and two themes; seven
  of nine checks passed. It failed two, both real: the photo picker had **no
  keyboard focus indicator**, and three header buttons were 40 px tall. It also
  reported wrapped button labels and clipped placeholders. All fixed.
- The `web-design-guidelines` skill (Vercel's Web Interface Guidelines) found: a
  search input with its outline removed and nothing in its place; a hero that
  autoplays for more than five seconds with no pause control; a sticky header
  that could cover a focused element; images without dimensions; spellcheck on
  email, ISBN and course-code fields; and no warning before leaving a
  half-written listing. All fixed. Left as they are, deliberately: sentence case
  rather than Title Case, and a 300 ms `filter` transition on a sold photo.

**AI mistakes in this phase**

- **AI renamed the product.** Following the reviewers, the header and page
  titles became "NMIT Marketplace". The author had been explicit earlier that
  the project is called Campus Marketplace, and a rename is not a reviewer's
  decision or the AI's. AI noticed, said so, and reverted it before committing.
- The first hero implementation read `public/hero` from disk on each request,
  which works locally and returns nothing on Vercel. Caught before it was built
  on, and moved to build time.
- AI's own smoke test was interrupted by the unsaved-changes prompt it had just
  added - correct behaviour, but it cost a re-run.

**Verified by testing** (production build)

- The QA agent's screenshot matrix and checks, as above.
- After the QA fixes and the name revert, on the final build: publish with a
  photo and a ₹19.99 price, then delete, completed; header controls measured at
  44 px; the photo picker shows a 2 px outline on keyboard focus; "Scan barcode"
  is one line; six teaser cards show to a signed-out visitor.
- The teaser function returns card fields only, and a signed-out client is
  still refused a direct read of the table.
- `npm run verify:rls`: 12 of 12.

**Not verified**

- Colour contrast was calculated by the Designer agent, not measured with an
  audit tool.
- No screen reader was used. ARIA and focus order were checked by reading the
  DOM and tabbing, not by listening.
- The final build was checked by targeted measurements, not by repeating the
  full 56-screenshot matrix.
- No real phone, and no Safari or Firefox: everything ran in Chromium.
- The hero with real photographs. Only the generated placeholders have been
  seen.
- The redesign on the deployed site.

**Author changed / verified**

- Chose the design reference and set the requirements for the home page, the
  hero, dark mode and the SOLD treatment.
- Applied migration 0007.
- _Replacing the placeholder hero and demo images: **pending**._
- _Code review of the above files: **pending author review**._

---

## Phase 5b — Listing chat and meetup booking

The author reopened the frozen scope for this phase.

**Asked for**

> "New phase (overrides the scope freeze; I've decided): listing chat + meetup
> booking. Run Judge/Auditor/Designer reviewers first and show me the plan. …
> a buyer can start a conversation with the seller ('Ask about this item').
> Check the existing `inquiries` table in the schema and reuse or adapt it. …
> Realtime messages, an Inbox page … with unread indicators … RLS: only the
> buyer and seller of that conversation can read or write it; a seller can't
> chat with themselves; message length limits; client + server validation.
> Add tests to `verify:rls` proving a third user cannot read or post … 'Propose
> meetup' in the chat: pick a campus pickup spot + date + time (future only,
> sensible hours). The other person can Accept or Suggest another time. Only
> one active meetup per conversation. Once accepted, show 'Meetup: [spot],
> [day, time]' on the listing for both buyer and seller, and in the chat."

and, after AI showed the plan with five open decisions:

> "Go with all five defaults. For #2, generate the outsider password yourself
> and write it to .env.local (don't print it)."

**AI produced**

| File | What it is |
| --- | --- |
| `supabase/migrations/0008_chat_meetups.sql` | `conversations`, `messages`, `meetups`; grants, policies, seven functions, two triggers; drops `inquiries` |
| `src/app/inbox/` | Inbox page, conversation page, their loading and not-found states, Server Actions |
| `src/components/chat/` | Thread and composer, meetup bar and dialog, "Ask about this item" form, unread badge, live refresh |
| `src/lib/chat.ts`, `types/chat.ts`, `validation/chat.ts` | Read queries, row types, zod schemas |
| `src/lib/campus-time.ts` | Dates and times in campus time, formatted identically on server and browser |
| `src/lib/use-new-messages.ts` | Realtime subscription to new messages |
| `listings/[id]/page.tsx`, `listings/mine/page.tsx`, `owner-actions.tsx`, `site-header.tsx`, `mobile-menu.tsx` | Chat entry points, accepted meetup on the listing, Inbox link and unread indicators |
| `scripts/seed-demo.mjs`, `scripts/verify-rls.mjs` | A third account and a seeded conversation; 24 new assertions |

**What the reviewers found (AI reviewing AI)**

- *Auditor:* `inquiries` could not be reused, because its insert policy checked
  only `buyer_id`, so a seller could message their own listing. Columns a client
  could forge (`seller_id`, `sender_id`, `created_at`) had to be set by the
  database. Meetup transitions belonged in functions, the one-active rule in a
  partial unique index, and the hours rule in campus time because Vercel runs in
  UTC. `verify:rls` would need a third account.
- *Judge:* the static "Meet at …" line on the listing would contradict an
  accepted meetup; deleting a listing silently deletes its chats; the docs still
  said messaging was dropped. It also listed what to leave out: typing
  indicators, read receipts, attachments, message editing.
- *Designer:* where each entry point goes, an unread indicator that is a number
  and not a colour, a native date input and a time list limited to campus hours.
- AI went beyond the reviewers in one place: giving clients an insert grant on
  only two columns of `messages`, so a forged sender is refused by privilege
  before any policy runs.
- AI overruled the Designer once: it suggested closing the message box when a
  listing is sold. Existing conversations stay open, because that is when the
  two people are arranging the handover. This was put to the author as a
  decision, not made silently.
- *QA agent:* twelve scenarios with three browser sessions. Eleven passed. It
  found five defects, all fixed: the dialog's buttons were 24 px tall on a
  phone; the chat page scrolled by one pixel (the header's border was not in
  the height sum); keyboard focus was lost after sending a counter-proposal;
  "Change" did not start from the agreed time and place; and a pending proposal
  said "Waiting for a reply" to the person who had to reply. A second pass on a
  fresh build confirmed each of the five.

**AI mistakes in this phase**

- **A constraint that did not do what its comment said.** The message rule was
  `char_length(btrim(body)) >= 1`. Postgres `btrim` strips spaces, not newlines,
  so a message of spaces around a newline was accepted. `verify:rls` failed on
  it the first time it ran - but by then the author had already applied the
  migration, and had to run a second block to correct it. AI had no local
  Postgres to try the SQL against, and should have said more plainly that the
  first run by the author was the first run by anyone.
- The plan shown to the author said three tables would be published to
  Realtime. While writing the migration AI published one, having noticed every
  meetup event also inserts a message. Reported to the author with the
  migration, not hidden, but it was a change after approval.
- A scripted edit to the seed file silently did nothing; it was noticed only
  because AI counted occurrences afterwards.
- The first unread-count code called a state-setting function directly in an
  effect, which the linter rejected; it was restructured.

**Verified by testing** (production build)

- `npm run verify:rls` against the live database: 34 of 36 on its first run
  (the two failures were the constraint bug above), then 36 of 36 after the
  author applied the correction and the demo data was reseeded.
- QA agent, scenarios A-L, as seller, buyer and a third user, at 390 px and
  1280 px, in light and dark: asking about an item; messages arriving in both
  directions without a reload (a marker set on `window` survived); the header
  count rising on another page; propose, counter-propose, accept and cancel,
  with the other person's page updating live; the accepted meetup shown on the
  listing to both participants and not to the third user; the third user
  opening the conversation's URL and getting the not-found page; sold
  listings; the composer's limits; no horizontal overflow; no console errors.
- `next build`, `tsc --noEmit` and `eslint` clean.

**Not verified**

- Nothing in this phase has been run on the deployed site.
- No real phone, no Safari or Firefox, no screen reader.
- "A time later today is accepted" could not be tried: the QA pass ran at about
  10 pm campus time, when every slot today had passed. Past times being refused
  was tested; the boundary was not.
- Two proposals made at the same instant. The row lock is there for that case
  and has not been exercised.
- More than two people in one listing's conversations at once, and long
  threads beyond the 200 messages a page loads.
- Realtime not leaking to a third user was shown by that user receiving
  nothing in the browser, not by an automated check: `verify:rls` makes no
  writes, so it has no message to listen for.

**Author changed / verified**

- Reopened scope and set the requirements.
- Decided the five questions AI raised: drop `inquiries`; add a third demo
  account; keep conversations open on sold listings; allow cancel and
  reschedule; accept that deleting a listing deletes its chats.
- Applied migration 0008, and the corrected constraint, by hand, and confirmed
  the constraint definition from the database.
- _Code review of the above files: **pending author review**._

---

## Phase 5c — "Make it ours": the after-dark redesign and the rename to Nitte Mart

**Asked for**

> "'Make it ours': full creative direction (replaces the Airbnb look). Run
> Judge/Designer reviewers first and show me the plan, plus 2–3 logo options as
> screenshots, before applying anything. Identity: rename to Nitte Mart
> everywhere … Concept: 'after dark', cinematic and dark-first … near-black
> canvas, deep indigo, warm yellow accent, AA contrast. Dark is the default;
> light mode keeps working. Bold condensed open-source display font … Homepage
> as 5 scroll scenes … a new `/security` receipts page that explains the RLS
> tests in plain language … Listing detail like an Apple product page … Copy:
> Zomato-style humour … Blocking errors must still say what to do next. …
> Demo data: rewrite the seed listings in real student voice … Motion: scroll
> reveals, subtle parallax, digit rollers, all respecting reduced motion …
> Never leave anything half-done."

The seven lines of copy quoted in the brief (the 404, the empty states, the
Gmail refusal and so on) are the author's own words and are used as written.

and, after AI showed the plan, three logo drawings and five open decisions:

> "Logo decision deferred to the very end. For now use a clean text-only
> wordmark … (2) dark default with a toggle remembered in a cookie; (3) yes to
> 0009 … (4) build the hero on placeholders with a dark grade … (5) use
> plausible subject codes … Keep the exact gate rule on /security. Go."

Later: the credit was changed to "Vedant Sharma" at the author's request.

**AI produced**

| File | What it is |
| --- | --- |
| `DESIGN.md` | Rewritten: the project's own system, replacing the downloaded Airbnb reference |
| `src/app/globals.css` | New tokens with dark as the default and light as the override; reveal, roller, stamp and grain CSS |
| `src/app/layout.tsx`, `components/layout/theme-toggle.tsx`, `site-footer.tsx`, `site-header.tsx` | Anton, the theme cookie, the toggle, the footer with the disclaimer, the text wordmark |
| `src/app/page.tsx`, `components/home/`, `components/motion/reveal-observer.tsx` | The five scenes, digit roller, scan illustration, hero grade, the scroll-reveal observer |
| `src/app/security/page.tsx` | The public receipts page |
| `supabase/migrations/0009_public_stats.sql` | Three read-only functions for the public home page |
| `listing-card.tsx`, `listings/[id]/page.tsx`, `condition-summary.tsx` | Photo-first cards, the product-page layout, "What's in the box" |
| `scripts/verify-rls.mjs`, `src/lib/security-run.json` | Three new checks; the run result written to a file the site displays |
| `scripts/seed-demo.mjs` | Listings and chat rewritten in a student's voice |
| Copy in the 404, empty states, error page, sign-up refusal, book lookup | The author's lines, plus the same voice elsewhere |
| `src/app/icon.svg` | A text "NM" favicon, standing in until the logo is chosen |

Three logo options were drawn as HTML and screenshotted for the author. None is
in the repository; the choice is still open.

**What the reviewers found (AI reviewing AI)**

- *Judge:* five scenes would bury the reviewer sign-up hint, which sat in the
  footer, so it moved into the hero. A "security tests passed" figure must not
  be a number typed into a page. "Locked to NITTE" overclaims: the gate is
  `nmit.ac.in` plus a demo domain. And the home page could not show a sold item
  or any count at all, because a signed-out visitor can read no table.
- *Designer:* exact token values with contrast ratios; that yellow cannot be
  text on a light canvas (about 1.4:1); Anton over Bebas Neue, which has no
  lower case; and a cookie-based theme so the first paint is right.
- AI did not take two of the Judge's cuts (make the scan demo static, merge two
  scenes): the author's brief gave its own order for cutting if time ran short,
  and time did not run short.
- *QA agent:* nine checks at two widths in both themes, 98 screenshots, and
  contrast measured from computed colours on every page. It found nine defects.
  One was serious: **the chat page showed the site footer and scrolled.** AI had
  written the CSS rule that hides the footer there and never added the attribute
  the rule looks for. Also: book covers letterboxed in the new portrait tiles; a
  sold card's accessible name began with its price, not "Sold"; two links under
  44 px; a sold listing still saying "Meet at …"; dark dialogs with no edge; and
  a headline whose two lines had no space between them in the markup. Seven
  were fixed. Two were left: the hero's search box is white in both themes by
  design, and a signed-out visitor to an unknown URL is sent to sign in rather
  than shown the 404, which is how the route gate has always worked.
- The `web-design-guidelines` skill led to four changes, listed in the
  write-up, and one finding deliberately left (the stamp animates `clip-path`).

**AI mistakes in this phase**

- The footer on the chat page, above: a rule with nothing to match.
- **A migration that would have changed the live site early.** The first draft
  of 0009 replaced the function the deployed home page calls. The local and
  live sites share one database, so the live page would have drawn a sold item
  as available from the moment the SQL ran until the new code was pushed. AI
  caught it before the author ran anything and added a new function instead.
- AI told the author 0009 was ready, then added a third function to it a few
  minutes later and had to say so. The author had not run it yet.
- The first logo screenshots had the wordmark cut off at the edge; redrawn
  before being shown.
- A scripted edit to the stylesheet failed with a file error. The file was
  checked and found intact, and the change was re-applied by hand.
- The first hero headline stranded its last word on a line of its own.

**Verified by testing** (production build)

- The QA pass and its re-check, as above.
- Measured contrast: nothing under 4.5:1 on any page in either theme. The
  lowest was muted text on the light soft surface, 5.27:1.
- Reduced motion: no element left hidden, no animation running, no pause button.
- The theme survives a reload with no flash, and the toggles stay in step.
- `next build`, `tsc --noEmit` and `eslint` clean.
- `npm run verify:rls` after the last change: 39 of 39, written to
  `src/lib/security-run.json`, which is the figure `/security` shows.

**Not verified**

- Nothing in this phase has been run on the deployed site.
- No real phone, no Safari or Firefox, no screen reader. The parallax runs only
  in browsers with scroll-driven animations and was seen in Chromium only.
- The hero text sits on a photograph, so its contrast was judged by eye, on
  placeholder images. Real photographs may need a heavier grade.
- Page weight and load time with the second typeface were not measured.
- With JavaScript disabled. The reveal design keeps content visible in that
  case; nobody loaded the page that way to confirm it.
- Whether the course codes in the demo listings are real. They are plausible.

**Author changed / verified**

- Set the whole creative direction, the name, the palette, the scenes and the
  copy lines.
- Decided: text wordmark for now, dark by default with a cookie toggle, the
  migration, placeholders for the hero, plausible course codes.
- Applied migration 0009 by hand.
- Chose the credit "Vedant Sharma".
- _Choosing a logo, and supplying campus photographs: **pending**._
- _Code review of the above files: **pending author review**._

---

## Skills used

Agent skills installed in this repository under `.claude/skills/`, and where
each was used:

| Skill | Source | Used for |
| --- | --- | --- |
| `playwright-cli` | microsoft/playwright-cli | Every browser check from Phase 2b on: the create/edit flow, the fake-webcam barcode test, two-session realtime tests, and all QA agent passes and screenshots |
| `web-design-guidelines` | vercel-labs/agent-skills | One review of all pages and components in Phase 5 against Vercel's Web Interface Guidelines |

`DESIGN.md` came from the `getdesign` CLI (the `airbnb` design). It is a
reference document, not a skill.

---

## Honesty note

AI-generated code was not accepted unreviewed. Where a suggestion was wrong or a
poor fit it was changed or rejected — the Cache Components decision in
`docs/architecture.md` is an example of a scaffolded default being deliberately
overridden rather than left in place.

Any entry above still marked _"pending author review"_ is an honest statement
that the author has not yet personally verified that code.
