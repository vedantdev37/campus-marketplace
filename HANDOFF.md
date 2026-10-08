# Handoff

State of the project for whoever picks it up next. Written at the end of Phase 5,
updated after Phase 5b (chat and meetups).

- **Live:** <https://nmit-campus-marketplace.vercel.app> (Vercel, auto-deploys on push to `main`)
- **Repo:** <https://github.com/vedantdev37/campus-marketplace> — folder `C:\Users\admin\Documents\campus-marketplace`
- **Name:** the product is **Nitte Mart**. The author renamed it from Campus Marketplace
  in Phase 5c; an earlier version of this file said never to rename it, and that was the
  author's rule to change. The repository, the folder and the Vercel URL keep the old name.
  Every page carries "A student project by Vedant Sharma. Not affiliated with NITTE."
- **Deadline:** GDG NMIT Round 2. Scope is frozen (see "What is left"); the author
  reopened it once, for Phase 5b.
- **Stack:** Next.js 16.4 App Router, React 19, TypeScript, Tailwind 4, Supabase (Postgres, Auth, RLS, Storage, Realtime), zod 4.

## Phase status

| Phase | What | State |
| --- | --- | --- |
| 0 | Scaffold, repo, env validation | Done |
| 1a | Schema, RLS, storage, sign-up domain gate | Done; migrations 0001–0005 applied |
| 1b | Auth: sign-up, login, logout, `proxy.ts` | Done |
| 2a | Browse, search, filters, detail, My Listings, mark-sold, delete | Done |
| 2b | Create/edit listing with photo upload | Done |
| 3 | ISBN lookup, barcode scan, autofill, fair-price guide | Done |
| 4 | Realtime sold updates, states audit, condition checklists | Done; migration 0006 applied |
| 5 | Design pass (DESIGN.md), home page, hero, dark mode | Done; migration 0007 applied |
| 5b | Listing chat, Inbox, unread counts, meetup booking | Done; migration 0008 applied |
| 5c | "After dark" redesign, rename to Nitte Mart, five-scene home, `/security` | Done; migration 0009 |
| 5d-A | Six post types, Explore, Post, Me, polaroid cards, tab bar | Done; migration 0010 applied |
| 5d-B | Profiles, Squad up, chat quick replies and typing, showcase profile | Done; no migration |
| 5d-C | Deal meter, wishlist and sold alerts, notifications, languages, commentary | Done; migration 0011 (security fixes) applied |
| 6 | Docs, diagrams, write-up, video, final review | In progress |

Supabase dashboard settings already made: "Before User Created" hook enabled
(`hook_restrict_signup_by_email_domain`); email confirmation OFF (demo only).
Vercel env vars set, including `GOOGLE_BOOKS_API_KEY`.

## Commands

```bash
npm run dev            # dev server
npm run build && npm run start   # production build - test against THIS, not dev
npm run verify:rls     # 66 checks; must stay 66/66 (run reseed:demo first). Writes
                       # src/lib/security-run.json, which the site displays: commit it.
npm run reseed:demo    # wipe + recreate demo listings with images; run before submitting
npm run test:deal      # the deal meter's arithmetic, 9 checks
```

Demo accounts: `seller@reviewer.test`, `buyer@reviewer.test`, and
`outsider@reviewer.test` (in no conversation; the attacker in `verify:rls`). Passwords
are only in `.env.local` (`DEMO_SELLER_PASSWORD`, `DEMO_BUYER_PASSWORD`,
`DEMO_OUTSIDER_PASSWORD`) — never commit them.
Reviewers can sign up with any `@reviewer.test` address.

## Decisions and why

- **Cache Components off** (`next.config.ts`). With it on, reading `cookies()` outside
  Suspense is a build error, and `@supabase/ssr` reads cookies on every request.
- **No service-role key anywhere.** RLS is the only enforcement point; seed and verify
  scripts use the publishable key so a passing run proves the policies.
- **Sign-up gate in the database** (auth hook + allowlist table), not app code: the
  publishable key lets anyone call the signup endpoint directly. Deny by default.
- **`getClaims()` not `getUser()`**: verifies the JWT locally, no network call per render.
- **Photos upload from the browser to Storage** at `<uid>/<uuid>.<ext>`; Server Action
  bodies are capped at 1 MB. The action re-checks the path is in the caller's folder.
- **Photo required on create**; an edit may replace but not remove one.
- **Two book sources**: Google Books first, Open Library fallback (see gotchas). Only an
  INR price is autofilled; otherwise the seller types the MRP. Covers are copied into
  the seller's own Storage folder by the server, never hot-linked.
- **Realtime events are a signal, not data**: pages re-fetch through RLS on change. On
  browse a sold card greys in place instead of vanishing.
- **Condition checklists** are `jsonb`, validated by zod twice and by a DB trigger —
  the trigger matters because a user can insert their own row via the REST API.
- **One token system** in `globals.css`, described in `DESIGN.md` (rewritten in Phase 5c:
  near-black, indigo, one yellow accent, Anton headlines). Old class names alias the tokens.
- **Dark is the default and the OS setting is ignored.** The theme is `data-theme` on
  `<html>`, read from a `theme` cookie in `layout.tsx` so the first paint is right. Light
  is the override block in `globals.css`. No component uses a `dark:` variant.
- **Yellow is never text on the light theme** (1.4:1). Hence the separate `price` token,
  `on-accent` for text on yellow, and an ink outline on yellow buttons in light.
- **Every number on the home page is read, never typed**: counts from `public_stats()`,
  the test figure from `src/lib/security-run.json`. An unreadable source is left out.
- **Scroll reveals hide by script, not by default**: content is visible without JS, and
  all motion sits inside `prefers-reduced-motion: no-preference`.
- **SOLD is marked four ways** (pill, word, strike-through, greyscale) — never colour alone.
- **Signed-out home listings** come from `recent_listing_teasers()` (card fields only);
  the `listings` table itself stays closed to `anon`.
- **Chat writes are decided by the database, in three ways** (migration 0008): clients
  may insert only `conversation_id` and `body` into `messages` (a column-level grant, so
  the sender cannot be forged); conversations and meetups have no write grant at all and
  change only through `security definer` functions that read `auth.uid()` themselves;
  "one active meetup" is a partial unique index.
- **Every meetup event also inserts a message row**, so only `messages` is in the
  Realtime publication and one subscription covers a whole chat page.
- **Meetup times are campus time (IST)** whatever zone the code runs in:
  `src/lib/campus-time.ts`. The hours rule is a table CHECK; "in the future" is in
  `propose_meetup()` because a CHECK cannot use `now()`.
- **A conversation is marked read from the browser**, never while a page renders: a
  prefetched link would otherwise mark messages read.
- **Sold listings** refuse new conversations; existing ones stay open for the handover.
  **Deleting a listing deletes its chats** (cascade), and the confirm prompt says so.
- **Six kinds of post, one table** (migration 0010): `listings.type` is sale, rent, free,
  lost_found, skill_offer or team_request. Everything that differs by type is in
  `TYPE_INFO` (`src/lib/types/listing.ts`): badge word, end-state label, button label,
  whether it has a price or needs a photo.
- **`status = 'sold'` means "finished" for every type.** The label differs (Sold, Rented
  out, Claimed, Team full); the stored value does not, so every older rule that reads
  `status` is already right. Marking returned or claimed is the owner's ordinary update.
- **A post's type is fixed** by a trigger. The edit action reads it from the row, never
  from the form.
- **Rent it, Claim it, I'm in and Hire only open a chat** with a prefilled message. Nothing
  is booked or paid for on the site and no label says so.
- **Routes:** `/explore`, `/post`, `/me` are current. `/listings/[id]` is still the detail
  page. `/listings`, `/listings/new` and `/listings/mine` redirect, because the README's
  reviewer steps and old links use them.
- **Profiles are readable by any signed-in student and by nobody signed out.** A GitHub
  link is built from a stored username, never a stored URL.
- **The typing indicator is a Realtime broadcast on a channel named after the
  conversation, and that channel is not access-controlled.** Someone who knew a
  conversation id could see that somebody is typing, or fake it. No message can be read
  or written that way. Locking it needs a Realtime authorisation policy (a migration).
- **Reseed resets profiles too**, and re-uploads the showcase photo: clearing a Storage
  folder while a row still points into it leaves a broken image.
- **The deal meter is one function with no imports** (`src/lib/deal-meter.ts`), so
  `npm run test:deal` can load it directly. Fair = MRP x condition x category. No MRP,
  no verdict. The factors are judgement, and the page says so.
- **A listing's `created_at` and `sold_at` are set by triggers** (0011). Before that an
  owner could forge them through the API and pin a post to the top of the public home
  page. The final security review found it.
- **Saved posts** use the original `wishlist_items` table and policies. The "saved item
  just sold" alert matches a listings Realtime event against ids read under RLS.
- **Browser notifications are not push.** They need an open tab. Permission is asked only
  after the user presses the Settings row. Real push needs a service worker, stored
  subscriptions and a sender.
- **Hinglish and Kanglish change the headline lines only** (`src/lib/i18n.ts`), via a
  `lang` cookie read on the server. Nav, forms and errors stay English.
- **Dropped from scope**: push.

## Gotchas

- **Next 16 uses `src/proxy.ts`, exporting `proxy`** — not `middleware.ts`. A file with
  the old name never runs. Read `node_modules/next/dist/docs/` before trusting memory.
- **`@supabase/ssr` `setAll(cookies, headers)`**: the second argument carries
  `Cache-Control: private, no-store`. Dropping it risks a CDN serving one user's session.
- **Google Books returns nothing for print ISBNs** via `isbn:` even with a valid key, and
  429s with no key. That is why Open Library is the fallback. Do not "simplify" it away.
- **RLS-blocked writes return 0 rows, not an error.** Always `.select("id")` and check the
  count; checking only `error` reports a refused write as success.
- **PostgREST embeds must name the FK**: `profiles!listings_seller_id_fkey`. A bare
  `profiles(...)` is ambiguous at runtime; `tsc` and `next build` do not catch it.
- **Bulk inserts send `null` for keys missing from some rows**, not the column default.
- **`notFound()` returns HTTP 200** on routes with a `loading.tsx` (streaming). Assert on text.
- **Hero images are listed at build time** in `next.config.ts`; `public/` is not on the
  server filesystem on Vercel. New photos need a redeploy.
- **Windows / this machine:**
  - PowerShell blocks `npx.ps1` — use `npx.cmd` / `npm.cmd`, or Git Bash.
  - `C:\Users\admin` is itself a git repo. Always work inside the project folder.
  - `next dev` intermittently times out (~10 s) calling Supabase while compiling. Cause
    not found. It does not happen in a production build — test against `npm run start`.
  - Stopping a background server task may leave the real process alive. Kill by port:
    find the PID with `netstat -ano | grep ":3000 .*LISTENING"`, then `taskkill //PID <pid> //T //F`.
  - Bash heredocs containing apostrophes break in the agent shell. Write files with the
    file tool, or commit with `git commit -F -` and no apostrophes in the message.
- **`playwright-cli run-code`** returns empty output if a script runs past ~60–90 s while
  the script keeps going. Keep scripts short; never overlap two in one session. Scripts
  have no `fs`. The listing form now raises a "leave site?" dialog once edited —
  register `page.on("dialog", d => d.accept())` first.
- **Migrations are applied by hand** in the Supabase SQL Editor. Never push code that
  depends on a migration before confirming it is applied.
- **0008 drops `inquiries`**, so `0002` can no longer be re-run as written.
- **`listListings` always filters by type** (default: sale). A row of another type drawn
  by code that did not expect it shows as a 0-rupee sale. Any new query on `listings`
  must say which types it wants.
- **Seeding non-sale rows before the code that understands them is deployed** puts them
  on the live browse page as 0-rupee sales: local and live share one database.
- **0009 adds `home_listing_teasers()` and leaves 0007's function alone on purpose.** The
  local and live sites share one database: replacing a function the deployed code calls
  changes the live site the moment the SQL runs, before the new code is pushed.
- **Postgres `btrim(text)` strips spaces only**, not newlines. A length check on
  `btrim(body)` let a whitespace-only message through; use `body ~ '\S'`. The older
  `listings` title and description checks have the same weakness.
- **`verify:rls` needs a pending meetup** for its two self-accept checks; it prints SKIP
  for them once someone has accepted the seeded proposal. `reseed:demo` restores it.
- **Realtime DELETE events ignore RLS** (the row is gone, so no policy can be checked):
  every subscriber receives the primary key. Chat subscribes to INSERT only.

## How we work

1. **Before each phase**, three read-only reviewer sub-agents run in parallel, reports
   under 200 words: **Judge** (strict rubric evaluator), **Auditor** (security, RLS,
   validation, edge cases, states), **Designer** (UX vs DESIGN.md, mobile first). Merge
   into a short plan, show the author, then build.
2. **After each phase**, a **QA agent** drives real flows with `playwright-cli` as seller
   and buyer, at 390 px and desktop, with screenshots and a pass/fail report. Fix fails
   before committing.
3. Check reviewer claims before acting on them; they are AI reviewing AI.
4. **Small commits** with `feat:` / `fix:` / `docs:` / `style:` / `test:` / `chore:`
   prefixes and a body that explains why. Push after each phase.
5. **`AI_USAGE.md` gets an entry after every phase**: the prompt, files produced, what
   reviewers found, AI mistakes, verified vs not verified. Be honest about gaps.
6. Explain key decisions briefly as you go — the author must be able to defend every line.
7. New UI follows `DESIGN.md`. Never leave a feature half-done. Do not use the Vercel
   connector; the author deploys from his own account.

## Since the first handoff (all pushed, all live)

- **Rename and design:** the product is Nitte Mart; dark-first "after dark" system in
  `DESIGN.md` (near-black, indigo, one yellow, Anton title cards, polaroid cards).
- **Chat and meetups** (0008), **six post types** (0010: sale, rent, free, lost_found,
  skill_offer, team_request), Explore / Post / Me, phone tab bar, **Squad up**,
  **profiles** with skills and photo, showcase profile for Vedant Sharma.
- **Wishlist** with a "saved item just sold" alert, **browser notifications** (open tab
  only, not push), **deal meter** (`src/lib/deal-meter.ts`, `npm run test:deal`),
  **Hinglish / Kanglish** headline lines, `/commentary`, `/security`, loading tips,
  console `credits()`.
- **Security review** done: one medium finding (forgeable `created_at` / `sold_at`) fixed
  in 0011, plus three small hardenings.
- **Migrations 0001 to 0011 are all applied.** `verify:rls` is **66/66**; `test:deal` 9/9.
- Demo accounts: seller, buyer, outsider, vedant `@reviewer.test`; passwords in
  `.env.local` as `DEMO_*_PASSWORD`. Stock demo photos credited in `docs/credits.md`.

## What is left

### 1. Logo (before Phase 6)

Three options were drawn and shown: A Silhouette, B Outline, C Badge. Source:
`docs/brand/cart-logo-options.html` (symbols `markA`, `markB`, `fav`). **The author has
not chosen yet.** When chosen: put the mark beside the Anton wordmark in
`site-header.tsx` (yellow on dark, ink on light), replace `src/app/icon.svg` with the
`fav` symbol, update `DESIGN.md`, delete the options file, QA at 390 px and desktop in
both themes, commit, push.

### 2. Phase 6: deliverables (the author's brief, in order)

Nothing in Phase 6 is committed except what is listed under "Already prepared".

1. **README:** replace with the author's text (pasted in the previous session; ask for it
   again). Keep the voice exactly. Only: fill `[N]` with the `verify:rls` count (66), put
   the existing setup steps inside "run it locally", turn file names into links, and
   verify every claim on the live site, reporting anything untrue instead of rewriting.
   Known issues to raise: it says "search 21CS32" but the seed uses `22CS32`; "testing on
   real phones" is the author's own claim, nothing automated used a phone.
2. **Write-up:** `docs/write-up-draft.md` is a finished ~1,500-word draft with no TODOs.
   Review it (it says "four" public functions and "64 assertions": make those "five" and
   "66"), replace `docs/write-up.md` with it, delete the draft, export a PDF
   (`playwright-cli pdf` works; no pandoc here).
3. **`AI_USAGE.md`:** final summary at the top (tools, models: commits credit Claude
   Opus 5 and Opus 5.5; skills; the reviewer and QA process). In every phase add a clearly
   marked, EMPTY "What I did / checked" section for the author. Do not write it for them.
   Add a Phase 6 entry and the logo.
4. **`/security-review`:** done this session (see `AI_USAGE.md`, Batch C). Re-run only if
   code changes.
5. **Fresh demo passwords:** generate new `DEMO_*_PASSWORD` values, rotate each account
   (sign in with the old one, `updateUser`, ideally sign out globally: a QA agent printed a
   buyer session cookie into its own output), then `npm run reseed:demo` and
   `npm run verify:rls`. Never print passwords in chat: they go in `SUBMISSION.md`.
6. **Final live check** with `playwright-cli` on the live URL as seller, buyer and
   outsider: every required feature and bonus, as a pass/fail table; fix fails.
7. **Video script:** a 3-minute shot list (hook in 10 s; gmail refused then
   `@reviewer.test`; ISBN scan; search and filter; owner-only edit and sold, buyer
   blocked; chat and meetup; live SOLD on two devices; deal meter; rent, free, Squad up),
   marking phone vs laptop shots.
8. **`SUBMISSION.md`**, not committed (add it to `.gitignore`): links, demo credentials,
   short summary.
9. Commit and push. After that nothing else is pushed.

### Already prepared for Phase 6

- `docs/diagrams/architecture.png`, `rls-sequence.png`, `isbn-flow.png`, and their source
  `docs/diagrams/diagrams.html`. Drawn by hand as SVG: there is no "Archify" tool here.
  The draft write-up already embeds them.
- `docs/write-up-draft.md`.

### Open questions for the author

- Logo choice (A, B or C).
- The Hinglish and Kanglish lines shipped as drafted; the author has not confirmed them.
  The Kanglish needs a Kannada speaker.
- Real hero photos (`public/hero/`) and real course codes are still placeholders.

### Not verified anywhere

A real phone, the native Android barcode path, iOS Safari, Firefox, a screen reader. On
the deployed site only page loads have been checked since Batch A; step 6 covers the rest.
