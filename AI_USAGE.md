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

## Phase 1 — Database schema, RLS and authentication

_(Added when the phase completes.)_

---

## Honesty note

AI-generated code was not accepted unreviewed. Where a suggestion was wrong or a
poor fit it was changed or rejected — the Cache Components decision in
`docs/architecture.md` is an example of a scaffolded default being deliberately
overridden rather than left in place.

Any entry above still marked _"pending author review"_ is an honest statement
that the author has not yet personally verified that code.
