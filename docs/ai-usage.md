# AI usage declaration

This project was built with AI assistance. This document states plainly what
that assistance was, so the work can be assessed accurately.

## Tool used

Claude (Anthropic), via Claude Code, used interactively throughout development.

## What AI was used for

- **Scaffolding and configuration.** Generating the initial Next.js project,
  config files, environment templates and documentation structure.
- **Schema and RLS policy drafting.** Writing the SQL migrations, then
  explaining what each policy permits and denies.
- **Implementation.** Writing components, Server Actions and validation
  schemas, under direction about what to build and how it should behave.
- **Surfacing framework-specific pitfalls.** Several decisions in
  `architecture.md` came from AI reading the bundled Next.js 16 documentation
  and flagging behaviour that differs from older versions — the Cache
  Components / cookie interaction being the clearest example.
- **Reviewing.** Checking work for security gaps and incorrect assumptions.

## What I did

_(Author: replace this section with your own honest account before submitting.
It should be true of you, not aspirational. Suggested points to address:)_

- Which decisions you made or overruled, and why.
- Which parts you wrote or debugged yourself.
- How you verified the code does what it claims — what you tested, and how.
- Anything you asked the AI to explain because you didn't initially follow it.
- Anything you still consider a weak spot in your own understanding.

## Honesty note

AI-generated code was not accepted unreviewed. Where a suggestion was wrong or
a poor fit, it was changed or rejected — the Cache Components decision in
`architecture.md` is an example of a scaffolded default being deliberately
overridden rather than left alone.
