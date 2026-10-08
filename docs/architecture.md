# Architecture & design decisions

A running log of the decisions that shaped this project, and why. Written as we
go, so the reasoning is recorded while it's still fresh rather than
reconstructed afterwards.

---

## Decision log

### 1. Next.js 16 Cache Components is deliberately **disabled**

`create-next-app` scaffolds Next 16 with `cacheComponents: true` and
`partialPrefetching: true`. Both were removed.

**What Cache Components does.** It makes data fetching dynamic by default and
lets you opt into caching per component with `use cache`. Next prerenders a
static HTML shell and streams dynamic content into it (Partial Prerendering).

**Why it's wrong for this app.**

1. **It conflicts with cookie-based auth.** With Cache Components on, reading
   `cookies()` outside a `<Suspense>` boundary is a *build error*. The Supabase
   SSR client reads auth cookies on essentially every authenticated request.
   Working within that model means routing every session read through
   `use cache: private` scopes behind explicit Suspense boundaries — real
   complexity, and the errors appear at `next build` time (i.e. on Vercel),
   not during `next dev`.
2. **This app wants fresh reads, not cached ones.** A marketplace where a
   listing can be marked sold at any moment, plus a Realtime subscription
   pushing those changes, is the opposite of a cache-friendly workload.
   Caching would actively work against the "changes reflected immediately"
   requirement.
3. **The cost of being wrong is asymmetric.** There is a hard deadline. A
   build-time failure mode on the deployment platform is the worst possible
   place to discover a caching mistake.

**What we give up:** Partial Prerendering and instant per-segment navigation.
Neither is a requirement here, and Suspense boundaries plus `loading.tsx` still
provide the streaming loading states the brief asks for.

Note that `partialPrefetching` *requires* `cacheComponents` — Next fails config
validation if you enable one without the other, so they are disabled together.

---

### 2. No service-role key anywhere in the application

Supabase issues a secret "service role" key that bypasses Row Level Security.
This project never uses one, and `.env.example` deliberately does not include it.

**Why:** if the app can bypass RLS, then RLS is no longer the thing actually
protecting the data — the correctness of every server-side code path is. By
having only the publishable (anon) key available, the database is the single
enforcement point, and a bug in application code cannot leak or destroy another
user's rows.

The publishable key is safe to ship to the browser *precisely because* RLS is
enabled on every table. That property is load-bearing, not incidental.

---

### 3. Validation is defined once and enforced twice

zod schemas live in a shared module and are used in two places:

- **Client** — immediate inline feedback as the user types, before a round trip.
- **Server** — re-parsed inside the Server Action, because a client-side check
  is a usability feature, never a security boundary. A request can be crafted
  by hand.

Defining the shape once avoids the classic drift where client and server
disagree about what's valid.

Ownership is checked the same way: the UI hides controls the user shouldn't
have, the Server Action re-verifies the session and ownership, and RLS enforces
it at the database level regardless. Three layers, each independently sufficient
at the data layer.

---

### 4. `src/` directory layout

Application code lives under `src/`, keeping the repo root for configuration
only. Purely organisational, but it makes the root readable at a glance.

---

### 5. Line endings normalised to LF

Development is on Windows. Without `.gitattributes`, Git records CRLF and every
file touched on another machine shows as entirely rewritten. `* text=auto eol=lf`
keeps diffs limited to actual changes — which matters when the commit history
itself is being assessed.

---

## Data model

Implemented in `supabase/migrations/0001_schema.sql`.

### `profiles`
Mirrors `auth.users`, holding the public-facing fields. Supabase keeps
`auth.users` in a schema the app can't expose directly, so a seller's display
name needs a row the app *can* read.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | FK → `auth.users(id)` on delete cascade |
| `full_name` | `text` | |
| `created_at` | `timestamptz` | default `now()` |

Populated by a trigger on `auth.users` insert, so a profile always exists.

### `listings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `seller_id` | `uuid` | FK → `profiles(id)`, cascade |
| `title` | `text` | required |
| `description` | `text` | required |
| `price` | `numeric(10,2)` | required, `>= 0` |
| `category` | `listing_category` enum | books, electronics, furniture, hostel, notes, other |
| `condition` | `item_condition` enum | new, like_new, good, fair, poor |
| `status` | `listing_status` enum | `available` \| `sold`, default `available` |
| `image_path` | `text` | path within the Storage bucket, not a full URL |
| `pickup_spot_id` | `uuid` null | FK → `pickup_spots(id)` |
| `course_code` | `text` null | e.g. `21CS32` |
| `semester` | `smallint` null | `between 1 and 8` |
| `isbn` | `text` null | set by the barcode scan |
| `book_author` | `text` null | from Google Books |
| `original_price` | `numeric(10,2)` null | from Google Books — the fair-price baseline |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` maintained by trigger |

**Why `image_path` and not a URL.** Storing the bucket-relative path means the
public URL is derived at render time. If the bucket or project URL changes,
no rows need rewriting.

**Why `original_price` is stored.** The fair-price hint must stay stable and
must not require a Google Books call on every page view. Condition is applied
to it at display time, so the heuristic can be tuned without a migration.

**Search.** A generated `tsvector` column over `title`, `description`,
`course_code` and `book_author`, with a GIN index — so search covers course code
and author, not just the title. Category, status, semester and pickup spot are
plain indexed columns for filtering.

### `pickup_spots`
A seeded lookup table (`name`, `description`), not an enum — spots are campus
data that may change, and a filter UI needs to list them.

### `wishlist_items`
`(user_id, listing_id)` composite primary key — the key itself prevents
duplicate saves, with no application logic needed.

### `inquiries` *(bonus 4)*
`listing_id`, `buyer_id`, `body`, `created_at`. Designed now so the schema
doesn't need reshaping if it gets built.

---

## Security model

Implemented in `supabase/migrations/0002_rls.sql` and `0003_storage.sql`.

RLS is enabled on **every** table, with no permissive fallback policy.

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | any authenticated user (sellers must be nameable) | own row only |
| `listings` | any authenticated user | `insert` where `seller_id = auth.uid()`; `update`/`delete` only where `seller_id = auth.uid()` |
| `pickup_spots` | any authenticated user | none (seeded by migration) |
| `wishlist_items` | own rows only | own rows only |
| `inquiries` | listing owner or the buyer who sent it | buyer inserts own |

Browsing requires a session. For a campus marketplace that's the correct
default, and it keeps every policy expressible as a comparison against
`auth.uid()` rather than needing anonymous-read carve-outs.

**Mark-as-sold** is an `update` on `listings`, so it is covered by the same
owner-only policy as edit — there is no separate privilege to get wrong.

**Storage.** One `listing-images` bucket, public read, with an insert policy
restricting a user to a folder named after their own uid. Public read is
deliberate: listing photos are not sensitive, and it lets `next/image` optimise
them without signed-URL round trips.

### Restricting sign-up to `@nmit.ac.in`

Enforced by a **Supabase "Before User Created" auth hook** backed by a
`signup_allowed_domains` table (`supabase/migrations/0004_...`).

**Why not in application code.** The publishable key lets anyone POST directly
to `/auth/v1/signup`. A domain check inside a Server Action is bypassable with
one hand-crafted request, so it would be decoration. The hook runs inside the
database on the auth service's own insert path, which cannot be routed around.
zod still validates the field in the form, purely for fast feedback.

**Two deliberate deviations from Supabase's published example:**

1. **Deny by default.** The official sample keeps both an `allow` and a `deny`
   list and *permits* an address when neither matches. That is allow-by-default:
   forget to deny a domain and it gets in. This implementation is a pure
   allowlist, so the failure mode is a legitimate user being refused rather than
   an illegitimate one admitted.
2. **A bug fix.** The official sample compares `lower(domain)` against
   `lower($1)`, where `domain` collides with the table's own column name and
   `$1` is the `jsonb` event argument, not the extracted domain. The local
   variable here is prefixed (`v_domain`) to avoid the shadowing.

The function is `security definer` with `search_path` pinned empty, so it can
read the allowlist regardless of caller while being immune to search-path
hijacking — which is why every identifier inside it is schema-qualified.
`execute` is granted only to `supabase_auth_admin` and revoked from `anon` and
`authenticated`: a client-callable hook would be an oracle for probing which
domains are permitted.

**Reviewer access.** Sign-up is itself a graded requirement, and a reviewer has
no campus address. The allowlist therefore also contains `reviewer.test`
(reserved by RFC 2606, so it can never be a real domain). This keeps the gate
genuinely enforced and *demonstrable* — a `gmail.com` attempt returns 403 —
while leaving the required flow testable. The row is marked for deletion in a
real deployment.

### Email confirmation is off for the demo

A conscious trade-off, not an oversight. With confirmation on, every test
account needs a real inbox, which makes the walkthrough video slow and blocks
reviewers. With it off, nobody proves they own the address they register, so the
domain gate becomes the only control on who gets in. Acceptable for an assessed
demo; a real deployment should leave confirmation on, at which point the campus
domain restriction also starts meaning something stronger.

---

## Open items

Moved to the "Not verified / known limitations" list in
[`write-up.md`](write-up.md#8-testing-and-verification), which is kept current.
The migrations have been applied and exercised by the seed and verify scripts.

## External API integration

_(Added when the Google Books integration lands.)_
