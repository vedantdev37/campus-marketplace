# Nitte Mart

hey judge 👋

yes, this is the round 2 assignment. same brief everyone got.
i'm Vedant Sharma, first year CSE. i didn't want to build "a marketplace",
i wanted to build the one people at NITTE would actually open.

live: https://nmit-campus-marketplace.vercel.app

## how to get in (takes 20 seconds)

normally only @nmit.ac.in emails can sign up. you probably don't want to
use yours, so i opened a test door just for judges:

1. open the site and tap **Sign up**
2. email: anything ending in **@reviewer.test**, like judge1@reviewer.test
   (it's a fake domain, nothing gets sent anywhere)
3. password: anything, at least 8 characters
4. that's it. no email confirmation, you're in.

want to see a ready made account with listings, chats and a meetup?
the seller and buyer logins are in my submission notes.

curious? try signing up with a gmail id. it'll bounce you at the gate.
that's the database saying no, not just the form.

---

## got 60 seconds? try these

1. scroll the homepage and find "Locked to NITTE". then open /security.
   i wrote a script that attacks my own app. it loses every time.
2. post a book and hit scan. point your phone at the barcode.
   the title, author and cover fill in on their own.
3. search 22CS32. course codes are searchable, so juniors find the
   exact book for their subject.
4. open any listing, message the seller, and book a meetup at a real
   spot on campus. "meet at main block" with no time never works.

## what's actually different here

you can't get in unless you're from NITTE. the database itself refuses
other emails, not just the sign up form.

nobody can edit or delete your stuff. i tried. 66 attack checks, all blocked.

it's not only buying and selling. you can rent things you only need once
(a drafter for one ED class), give stuff away for free, post things you
found on campus, and find teammates for a hackathon in Squad up.

every listing tells you if the price is a steal or a rip off, based on
the MRP and how used it is.

things update live. if someone buys what you're looking at, it turns
SOLD on your screen. no refresh. save something you like and you'll
know the moment it sells.

and if english feels too formal, switch it to Hinglish or Kanglish.

## stuff that broke

Google Books gave me zero results for every Indian ISBN i tried, even
with a valid key. so it falls back to Open Library now.

a blocked write in Supabase doesn't throw an error. it just changes
nothing and says it worked. my code believed it for a while.

there's more of this on the /commentary page. think of it like a
director's commentary, but for code.

## things i switched off for judging

email confirmation is off, so you can sign up instantly with a fake
@reviewer.test address. in real life i'd turn it back on with a proper
email provider (Supabase's free one only sends a few emails an hour),
and remove the @reviewer.test door so only @nmit.ac.in gets in.

## about AI

i used AI a lot and i'm not going to pretend otherwise.
every phase is written down in [AI_USAGE.md](AI_USAGE.md), prompts included.
the ideas, the decisions and the testing on real phones and real books
were mine. so was arguing with it when it was wrong, which happened.

## for the nerds

Next.js 16, Supabase (Postgres, row level security, realtime, storage),
Tailwind, deployed on Vercel.

architecture: [docs/architecture.md](docs/architecture.md)
write up: [docs/write-up.md](docs/write-up.md)

<details>
<summary>run it locally</summary>

**Prerequisites:** Node.js 20+ (developed on 26.7) and npm 10+.

### 1. Clone and install

```bash
git clone https://github.com/vedantdev37/campus-marketplace.git
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
| `DEMO_VEDANT_PASSWORD`          | Any 8+ character password, for the author's showcase profile |

The app validates these on startup and names any variable that's missing, so a
typo produces a readable error rather than a crash deep inside a library.

### 4. Apply the database schema

Open **Supabase → SQL Editor** and run each file in
[`supabase/migrations/`](supabase/migrations/) **in numerical order**, one at a
time, checking each succeeds before the next:

| # | File | What it creates |
| --- | --- | --- |
| 1 | `0001_schema.sql` | Enums, tables, indexes, full-text search, triggers |
| 2 | `0002_rls.sql` | Grants, Row Level Security, policies, Realtime publication |
| 3 | `0003_storage.sql` | `listing-images` bucket and its object policies |
| 4 | `0004_signup_domain_allowlist.sql` | Email-domain gate for sign-up |
| 5 | `0005_seed.sql` | Pickup spots and the allowed sign-up domains |
| 6 | `0006_condition_checks.sql` | Condition checklists, the lab category, and two extra constraints. Run it on its own |
| 7 | `0007_listing_teasers.sql` | Lets the public home page show a few recent listings |
| 8 | `0008_chat_meetups.sql` | Conversations, messages and meetups, their policies and functions. Drops the unused `inquiries` table; do not re-run `0002` afterwards |
| 9 | `0009_public_stats.sql` | Three read-only functions for the public home page: live counts, pickup spot names, and recent listings including one sold |
| 10 | `0010_listing_types.sql` | A `type` on listings (sale, rent, free, lost and found, skill, team) with rules per type, and skills, bio, photo and GitHub username on profiles |
| 11 | `0011_hardening.sql` | Fixes from the security review: `created_at` and `sold_at` are set by triggers and cannot be forged |

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
   about the `supabase_realtime` publication being missing, then re-run `0002`
   (before `0008`, not after).

### 6. Seed the demo accounts

```bash
npm run seed:demo
```

Creates the seller, buyer, outsider and showcase accounts at `@reviewer.test`
with sample posts, a conversation and a meetup proposal, using the four
`DEMO_*_PASSWORD` values from `.env.local`. Safe to re-run.

To replace the demo data with a clean set:

```bash
npm run reseed:demo
```

The script holds no special privilege. It signs in as an ordinary user and
writes through the same public API the browser uses, so every insert is subject
to Row Level Security. This project has no service-role key.

### 7. Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run seed:demo` | Create the demo accounts, sample posts and conversations |
| `npm run reseed:demo` | Wipe and recreate the demo data |
| `npm run verify:rls` | Attack the API as a non-owner and as an outsider to a chat; 66 checks |
| `npm run test:deal` | The deal meter's arithmetic; 9 checks |

</details>

---

demo photos from Unsplash, credits in [docs/credits.md](docs/credits.md).
made in about 36 hours on chai and very little sleep.
