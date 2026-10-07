# Campus Marketplace

A buy/sell marketplace for a college campus. Students list things they no longer
need, browse what others are selling, and arrange a handover at a known pickup
spot on campus.

Built for the GDG NMIT Round 2 full-stack challenge.

- **Live:** _(not deployed yet — added in Phase 2)_
- **Repo:** _(added once the remote exists)_
- **Walkthrough video:** _(added before submission)_
- **Technical write-up:** [`docs/architecture.md`](docs/architecture.md)
- **AI usage declaration:** [`docs/ai-usage.md`](docs/ai-usage.md)

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

### Core
- [ ] Email/password sign-up and login
- [ ] Create a listing (name, description, price, category, image)
- [ ] Browse, search and filter listings
- [ ] Listing detail view
- [ ] Owner-only edit / delete / mark-as-sold
- [ ] Sold listings visually distinct from available ones
- [ ] "My Listings" page
- [ ] Loading, empty and error states throughout
- [ ] Validation on both client and server

### Planned differentiators
- [ ] **ISBN barcode scan → autofill.** Point the camera at a textbook's
      barcode; the Google Books API fills in title, author, cover image and
      list price.
- [ ] **Realtime sold updates.** A listing marked sold greys out for everyone
      currently viewing, without a refresh.
- [ ] **Campus pickup spots.** Each listing names a handover point (library,
      main gate, canteen…); browse can be filtered by spot.
- [ ] **Wishlist with sold alerts.** Save a listing; get told when something you
      saved is sold.

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

_(Migration steps land in Phase 1.)_

### 5. Run it

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

---

## Project structure

```
src/
  app/            # App Router routes, layouts and pages
  lib/
    env.ts        # zod-validated environment variables
docs/
  architecture.md # design decisions and data model
  ai-usage.md     # AI usage declaration
supabase/
  migrations/     # SQL schema and RLS policies
```

---

## Architecture notes

See [`docs/architecture.md`](docs/architecture.md) for the data model, the
security model (RLS + server-side ownership checks), and the reasoning behind
the significant decisions — including why Next.js 16's Cache Components is
deliberately left disabled.
