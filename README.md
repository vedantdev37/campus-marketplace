# Nitte Mart

A buy/sell marketplace for a college campus. Students list things they no longer
need, browse what others are selling, and arrange a handover at a known pickup
spot on campus.

Built for the GDG NMIT Round 2 full-stack challenge.

---

## ⭐ Evaluating this project? Start here

**Live app: <https://nmit-campus-marketplace.vercel.app>**

**Sign up with any email ending in `@reviewer.test`** — for example
`reviewer@reviewer.test`, with any password of 8+ characters. No inbox needed.

Sign-up is restricted to campus email domains, so `@reviewer.test` is seeded
into the allowlist specifically so the sign-up flow can be assessed. `.test` is
reserved by RFC 2606 and can never be a real domain.

**Or use a pre-seeded account**, to test owner-only actions without creating
listings yourself:

| Role | Email | What it has |
| --- | --- | --- |
| Seller | `seller@reviewer.test` | Several listings, one already sold |
| Buyer | `buyer@reviewer.test` | No listings, one wishlist item, one conversation with the seller and a meetup proposal waiting for the seller to accept |

**Passwords are in the submission notes, not in this repo.** This repository is
public, so a credential committed anywhere in it — README, seed script, or
history — would let anyone sign in and vandalise the demo data. The seed script
reads them from `.env.local`, which is gitignored.

Sign in as the **buyer** and open one of the seller's listings: there is no
edit, delete or mark-sold control. The API refuses those operations too — Row
Level Security rejects them at the database, not just in the UI. That is not a
claim you have to take on trust:

```bash
npm run verify:rls
```

attacks the public API directly: as a signed-in non-owner against listings,
and as a third account against a conversation between the buyer and the
seller. It makes 39 assertions. Most are things that must be refused - a
price change, a forged message sender, reading someone else's chat, accepting
your own meetup proposal - and three confirm the public home page receives
only what a listing card shows. The result of each run is written to
`src/lib/security-run.json`, which is what the site's "tests passed" figure
and the [`/security`](https://nmit-campus-marketplace.vercel.app/security)
page display.

**To see the restriction working**, try signing up with a `gmail.com` address.
It is refused with a 403 from a database-level auth hook, not a client-side
check — see
[`docs/architecture.md`](docs/architecture.md#restricting-sign-up-to-nmitacin).

---

## Links

- **Live:** <https://nmit-campus-marketplace.vercel.app>
- **Repo:** <https://github.com/vedantdev37/campus-marketplace>
- **Walkthrough video:** _(added before submission)_
- **Technical write-up:** [`docs/write-up.md`](docs/write-up.md) (decision log: [`docs/architecture.md`](docs/architecture.md))
- **AI usage declaration:** [`AI_USAGE.md`](AI_USAGE.md)

> **Status:** in development. This README is kept accurate as features land —
> anything listed under "Planned" is not built yet.

---

## Tech stack

| Concern         | Choice                                               |
| --------------- | ---------------------------------------------------- |
| Framework       | Next.js 16.4 (App Router) + React 19.3               |
| Language        | TypeScript (strict)                                  |
| Styling         | Tailwind CSS 4                                       |
| Database        | Supabase Postgres, with Row Level Security           |
| Auth            | Supabase Auth (cookie sessions via `@supabase/ssr`)  |
| File storage    | Supabase Storage                                     |
| Live updates    | Supabase Realtime                                    |
| Validation      | zod 4 (shared client + server schemas)               |
| External API    | Google Books, falling back to Open Library (ISBN → title, author, cover, price) |
| Hosting         | Vercel                                               |

---

## Features

### Core requirements
- [x] Email/password sign-up and login, restricted to `@nmit.ac.in` addresses
- [x] Create a listing (name, description, price, category, image)
- [x] Browse, search and filter listings
- [x] Listing detail view
- [x] Owner-only mark-as-sold and delete (enforced by RLS — see `npm run verify:rls`)
- [x] Owner-only edit
- [x] Sold listings visually distinct from available ones
- [x] "My Listings" page
- [x] Loading, empty and error states
- [x] Validation on both client and server (shared zod schemas)

### Campus-specific additions
- [x] Optional **course code** (e.g. `21CS32`) and **semester** on a listing,
      both searchable — so you can find the exact book your course needs.
- [x] **ISBN lookup and barcode scan → autofill.** Type the ISBN or point the
      camera at the barcode; title, author, description and cover are filled in
      from Google Books, falling back to Open Library. Every field stays editable.
- [x] **Fair-price hint.** Compares the asking price against the original
      price (from Google Books when it has one, otherwise the MRP the seller
      enters), adjusted for condition. Sellers see it live while pricing; buyers
      see it on the listing.

### Beyond the core

- [x] **Realtime sold updates.** A listing marked sold greys out for everyone
      currently viewing it, without a refresh.
- [x] **Campus pickup spots.** Each listing names a handover point (library,
      main gate, food court…); browse can be filtered by spot.
- [x] **Condition checklists.** Category-specific facts the seller confirms
      (charger included, no highlighting, lab coat size…), shown as ticks on
      the listing and validated by a database trigger.

- [x] **Listing chat.** "Ask about this item" opens a private conversation
      with the seller. Messages arrive live; an Inbox lists conversations with
      unread counts. Only the buyer and the seller can read or write it, which
      `npm run verify:rls` proves with a third account.
- [x] **Meetup booking.** Either person proposes a pickup spot, date and time
      inside the chat; the other accepts or suggests another. Once accepted it
      shows on the listing for those two people only.

- [x] **Its own look.** A dark-first design system ([`DESIGN.md`](DESIGN.md)),
      a five-scene home page with live counts from the database, a light theme
      behind a toggle, and a [`/security`](https://nmit-campus-marketplace.vercel.app/security)
      page that explains the access-control tests in plain language.

**Dropped from scope**, deliberately, rather than left half-built: wishlist UI
and push notifications. The `wishlist_items` table and its RLS policies exist
in the schema but have no UI.

---

## Local setup

**Prerequisites:** Node.js 20+ (developed on 26.7) and npm 10+.

### 1. Clone and install

```bash
git clone <repo-url>
cd campus-marketplace
npm install
```

### 2. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) and create a new project.
2. Pick a region near you and save the database password somewhere safe.
3. Wait for provisioning (~2 minutes).

### 3. Configure environment variables

Copy the template:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Then fill in `.env.local` from **Supabase → Settings → API**:

| Variable                        | Where to find it                                          |
| ------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | "Project URL"                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "Publishable key" (newer dashboards) or "anon key"        |
| `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000` locally                           |
| `GOOGLE_BOOKS_API_KEY`          | Needed for Google Books: without a key it now returns 429. Lookups still work without it, through Open Library |
| `DEMO_SELLER_PASSWORD`          | Any 8+ character password, for the seeded seller account  |
| `DEMO_BUYER_PASSWORD`           | Any 8+ character password, for the seeded buyer account   |
| `DEMO_OUTSIDER_PASSWORD`        | Any 8+ character password, for the third account `verify:rls` attacks chats with |

The app validates these on startup and names any variable that's missing, so a
typo produces a readable error rather than a crash deep inside a library.

### 4. Apply the database schema

Open **Supabase → SQL Editor** and run each file in `supabase/migrations/`
**in numerical order**, one at a time, checking each succeeds before the next:

| # | File | What it creates |
| --- | --- | --- |
| 1 | `0001_schema.sql` | Enums, tables, indexes, full-text search, triggers |
| 2 | `0002_rls.sql` | Grants, Row Level Security, policies, Realtime publication |
| 3 | `0003_storage.sql` | `listing-images` bucket and its object policies |
| 4 | `0004_signup_domain_allowlist.sql` | Email-domain gate for sign-up |
| 5 | `0005_seed.sql` | Pickup spots and the allowed sign-up domains |
| 6 | `0006_condition_checks.sql` | Condition checklists, the lab category, and two extra constraints. Run it on its own |
| 7 | `0007_listing_teasers.sql` | *Optional.* Lets the public home page show a few recent listings |
| 8 | `0008_chat_meetups.sql` | Conversations, messages and meetups, their policies and functions. Drops the unused `inquiries` table; do not re-run `0002` afterwards |
| 9 | `0009_public_stats.sql` | Three read-only functions for the public home page: live counts, pickup spot names, and recent listings including one sold. Without it the home page shows fewer things, not an error |

They are written to be re-runnable, so running one twice is harmless.

### 5. Three dashboard settings

The migrations cannot set these; they must be done in the dashboard.

1. **Enable the sign-up gate.** Authentication → Hooks → **Before User
   Created** → Postgres function → `public.hook_restrict_signup_by_email_domain`.
   Until this is enabled the function exists but is never called, and sign-up is
   open to any domain.
2. **Turn off email confirmation** (demo only). Authentication → Sign In /
   Providers → Email → disable **Confirm email**. Sign-up then works without an
   inbox round-trip. *Trade-off: nobody has to prove they own the address they
   register, so the domain gate becomes the only check on who gets in. A real
   deployment should leave confirmation on.*
3. **Enable Realtime** for the `listings` table if `0002` printed a notice
   about the `supabase_realtime` publication being missing — then re-run `0002`.

### 6. Seed the demo accounts

```bash
npm run seed:demo
```

Creates `seller@reviewer.test` (with listings, one already sold),
`buyer@reviewer.test` (with a wishlist item and a conversation with the seller)
and `outsider@reviewer.test` (in no conversation; `verify:rls` uses it as the
attacker), using the three `DEMO_*_PASSWORD` values from `.env.local`. Safe to
re-run — it leaves existing listings and conversations alone.

To replace the demo data with a clean set (worth doing right before a
demo or submission, after poking at it during testing):

```bash
npm run reseed:demo
```

Both the inserts and the deletes run under RLS as an ordinary signed-in user, so
the script cannot touch anything the demo accounts do not own.

The script holds no special privilege — it signs in as an ordinary user and
writes through the same public API the browser uses, so every insert is subject
to Row Level Security. A successful run is therefore evidence the policies allow
what they should. A service-role key would bypass RLS and prove nothing, which
is also why this project does not have one.

### 7. Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

> `.env.local` is only read at startup — restart the dev server after editing it.

---

## Scripts

| Command         | What it does                           |
| --------------- | -------------------------------------- |
| `npm run dev`   | Dev server (Turbopack) on port 3000    |
| `npm run build` | Production build                       |
| `npm start`     | Serve the production build             |
| `npm run lint`  | ESLint                                 |
| `npm run seed:demo` | Create the three demo accounts, sample listings and one conversation |
| `npm run reseed:demo` | Wipe and recreate the demo data |
| `npm run verify:rls` | Attack the API as a non-owner and as an outsider to a chat; assert everything is refused |

---

## Project structure

```
src/
  app/
    (auth)/       # /login and /signup, plus their Server Actions
    inbox/        # conversations, the chat page, and their Server Actions
    security/     # the public "receipts" page about the access-control tests
    listings/     # browse, detail, create/edit, My Listings
    error.tsx     # route-level error boundary
  components/
    auth/         # login and sign-up forms (client)
    chat/         # thread, meetup bar, unread badge
    home/         # hero, scan demo, digit roller
    layout/       # the shared header and footer, theme toggle
    motion/       # the one scroll-reveal observer
    listings/     # cards, the listing form, owner controls
    ui/           # TextField, SubmitButton, Alert
  lib/
    auth.ts       # session access (the Data Access Layer)
    chat.ts       # chat and meetup read queries
    campus-time.ts # dates and times in campus time (IST)
    env.ts        # zod-validated environment variables
    navigation.ts # open-redirect-safe destination handling
    supabase/     # server and browser clients
    validation/   # zod schemas shared by client and server
  proxy.ts        # session refresh + route gating (was middleware.ts pre-Next 16)
scripts/
  seed-demo.mjs   # demo accounts and sample listings
  verify-rls.mjs  # adversarial Row Level Security checks
docs/
  architecture.md # design decisions and data model
AI_USAGE.md       # AI usage declaration, per phase
DESIGN.md         # the design system: tokens, type, motion, voice
supabase/
  migrations/     # SQL schema and RLS policies
```

---

## Architecture notes

See [`docs/architecture.md`](docs/architecture.md) for the data model, the
security model (RLS + server-side ownership checks), and the reasoning behind
the significant decisions — including why Next.js 16's Cache Components is
deliberately left disabled.
