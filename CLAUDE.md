# CLAUDE.md

Pleiad: a personal spaced-repetition learning app (PWA first, native wrapper later). Owner: Martin.

## Read first
- SPEC.md: what to build. DESIGN.md: look and screens. PLAN.md: milestones and progress.
- Work on one milestone per session. Use plan mode first, then implement, then tick PLAN.md.

## Commands
- `npm ci` install, `npm test` unit tests, `npm run lint`, `npm run typecheck`, `npm run validate:content`, `npm run build`.
- Before finishing any task, run test, lint, typecheck and validate:content, and report results.

## Architecture rules (non-negotiable)
- `src/core` is pure TypeScript: no DOM, no browser APIs, no imports from `ui` or `platform`.
- All persistence through `StorageAdapter`; all time through the injected clock; never `Date.now()` in core.
- The scheduler is wrapped behind our own `Scheduler` interface.
- Card state must always be reproducible by replaying the append-only review log.
- New subjects are content-only changes (a new pack folder); never hardcode subject names in code.

## Conventions
- TypeScript strict; no `any` without a comment. Small modules, tests next to code.
- UI strings in one resource file, not inline. Colors and spacing only via tokens in `src/ui/tokens.css`.
- Dark theme only for now. No emoji in the UI. Respect reduced motion.
- Dependencies: ask before adding one; check license and maintenance; prefer small.

## Never
- Commit secrets, personal data, source PDFs or copyrighted text. The repo is public.
- Make third-party network requests at runtime (fonts, analytics, CDNs). Self-host assets.
- Mark questions `verified` yourself. Only Martin verifies; flip a status only when he names the IDs.
- Change the scheduling because of gamification.

## Content
- Questions need sources, a tier, a topic and `status: draft` until Martin verifies.
- Contested topics use attributed phrasing ("According to IIT...").
- Run `npm run validate:content` after any content change.

## When unsure
Ask Martin one short question, or choose the simplest option, note it under "Decisions log" in PLAN.md and continue.
