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

_(Added in Phase 1.)_

## Security model

_(Added in Phase 1 — RLS policies, table by table.)_

## External API integration

_(Added when the Google Books integration lands.)_
