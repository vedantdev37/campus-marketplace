# Campus Marketplace

A buy/sell marketplace for a college campus. Students list things they no longer
need, browse what others are selling, and arrange a handover at a known pickup
spot on campus.

Built for the GDG NMIT Round 2 full-stack challenge.

---

## ⭐ Evaluating this project? Start here

**Sign up with any email ending in `@reviewer.test`** — for example
`reviewer@reviewer.test`, with any password of 8+ characters. No inbox needed.

Sign-up is restricted to campus email domains, so `@reviewer.test` is seeded
into the allowlist specifically so the sign-up flow can be assessed. `.test` is
reserved by RFC 2606 and can never be a real domain.

**Or use a pre-seeded account**, to test owner-only actions without creating
listings yourself:

| Role | Email | Password | What it has |
| --- | --- | --- | --- |
| Seller | `seller@reviewer.test` | `DemoSeller#2026` | Several listings, one already sold |
| Buyer | `buyer@reviewer.test` | `DemoBuyer#2026` | No listings, one wishlist item |

Sign in as the **buyer** and open one of the seller's listings: there is no
edit, delete or mark-sold control, and the API refuses those operations too —
Row Level Security rejects them at the database, not just in the UI.

> These accounts are deliberately published demo credentials on a domain that
> cannot receive mail. They are not real secrets.

**To see the restriction working**, try signing up with a `gmail.com` address.
It is refused with a 403 from a database-level auth hook, not a client-side
check — see
[`docs/architecture.md`](docs/architecture.md#restricting-sign-up-to-nmitacin).

---

## Links

- **Live:** _(not deployed yet — added in Phase 2)_
- **Repo:** <https://github.com/vedantdev37/campus-marketplace>
- **Walkthrough video:** _(added before submission)_
- **Technical write-up:** [`docs/architecture.md`](docs/architecture.md)
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
| External API    | Google Books API (ISBN → title, author, cover)       |
| Hosting         | Vercel                                               |

---

## Features

### Core requirements
- [x] Email/password sign-up and login, restricted to `@nmit.ac.in` addresses
- [ ] Create a listing (name, description, price, category, image)
- [ ] Browse, search and filter listings
- [ ] Listing detail view
- [ ] Owner-only edit / delete / mark-as-sold
- [ ] Sold listings visually distinct from available ones
- [ ] "My Listings" page
- [ ] Loading, empty and error states throughout
- [ ] Validation on both client and server

### Campus-specific additions
- [ ] Optional **course code** (e.g. `21CS32`) and **semester** on a listing,
      both searchable — so you can find the exact book your course needs.
- [ ] **ISBN barcode scan → autofill.** Point the camera at a textbook's
      barcode; the Google Books API fills in title, author and cover image.
- [ ] **Fair-price hint.** Compares the asking price against the book's
      original price from Google Books, adjusted for the stated condition, so
      buyers can see whether a price is reasonable.

### Bonus features, in priority order
Built in this order, as time allows. Anything not reached is left unbuilt rather
than half-built.

1. [ ] **Realtime sold updates.** A listing marked sold greys out for everyone
       currently viewing it, without a refresh.
2. [ ] **Campus pickup spots.** Each listing names a handover point (library,
       main gate, canteen…); browse can be filtered by spot.
3. [ ] **Wishlist with sold alerts.** Save a listing; get told when something
       you saved is sold.
4. [ ] **Buyer–seller inquiry messaging.** Ask the seller a question about a
       listing.
5. [ ] **Push notifications.** Only if time genuinely allows.

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
| `GOOGLE_BOOKS_API_KEY`          | Optional — raises the Google Books rate limit             |

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

Creates `seller@reviewer.test` (with listings, one already sold) and
`buyer@reviewer.test` (with a wishlist item). Safe to re-run.

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
| `npm run seed:demo` | Create the two demo accounts and sample listings |

---

## Project structure

```
src/
  app/
    (auth)/       # /login and /signup, plus their Server Actions
    listings/     # browse (protected)
    error.tsx     # route-level error boundary
  components/
    auth/         # login and sign-up forms (client)
    ui/           # TextField, SubmitButton, Alert
  lib/
    auth.ts       # session access (the Data Access Layer)
    env.ts        # zod-validated environment variables
    navigation.ts # open-redirect-safe destination handling
    supabase/     # server and browser clients
    validation/   # zod schemas shared by client and server
  proxy.ts        # session refresh + route gating (was middleware.ts pre-Next 16)
scripts/
  seed-demo.mjs   # demo accounts and sample listings
docs/
  architecture.md # design decisions and data model
AI_USAGE.md       # AI usage declaration, per phase
supabase/
  migrations/     # SQL schema and RLS policies
```

---

## Architecture notes

See [`docs/architecture.md`](docs/architecture.md) for the data model, the
security model (RLS + server-side ownership checks), and the reasoning behind
the significant decisions — including why Next.js 16's Cache Components is
deliberately left disabled.
