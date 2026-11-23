# PLAN.md: Pleiad milestones

Status legend: [ ] open, [x] done. One milestone per Claude Code session. At the start of each session: read CLAUDE.md, SPEC.md (relevant sections), DESIGN.md (relevant screens), and this file; enter plan mode; propose steps; then implement. At the end: tick the boxes, record decisions below, commit.

Definition of done for every milestone: `npm ci && npm test && npm run build` pass locally and in CI; new logic has unit tests; layering rules pass; no new third-party runtime requests; PLAN.md updated.

## M0: Scaffolding
- [x] Vite + TypeScript strict + Preact + Vitest + ESLint + Prettier
- [x] Directory layout from SPEC section 3.2 with import-restriction lint rules for `core`
- [x] Injectable clock; `StorageAdapter` interface (no implementation yet)
- [x] `src/ui/tokens.css` from DESIGN.md; self-hosted Fraunces and Inter
- [x] PWA manifest + service worker shell; installable
- [x] GitHub Actions: typecheck, lint, test, build; deploy to Pages from `main`
- [x] Placeholder icon; README with install instructions for iPhone/iPad

## M1: Content model
- [x] Types and JSON schemas: pack, taxonomy, question (mcq, recall to start)
- [x] `validate-content.ts` and `build-content-index.ts`; `npm run validate:content` in CI
- [x] Two seed packs (Consciousness science, Philosophy of mind) with about 10 placeholder foundational questions, clearly marked `draft` or sample
- [x] Tests for validator rules

## M2: Shell, MCQ session, storage
- [x] Routing, tab bar (phone), five screens as stubs
- [x] IndexedDB `StorageAdapter`; cards, reviews, settings, meta; migrations framework
- [x] MCQ session UI and feedback screen per DESIGN 4.2 and 4.3
- [x] Review log written for every answer (eventId, deviceId, profileId)

## M3: Scheduling
- [ ] Verify FSRS library (license, maintenance, types); record choice below
- [ ] `Scheduler` interface and adapter; fixed-clock tests
- [ ] Daily queue: due first, new up to limit, 04:00 day boundary, interleaving, tier mix and auto-unlock
- [ ] Today screen with Start button and counts

## M4: More question types
- [ ] recall, short (with normalization and overrides), cloze, match, order
- [ ] Rating mapping and tests per type

## M5: Library
- [ ] Taxonomy-driven Library, shelves, subject page, tree rows, search
- [ ] Pack activation; lazy loading of question files; service worker caching of active packs
- [ ] Practice-this-subject entry point

## M6: Stats
- [ ] Retention, coverage, per-topic bars, weak-spot list, heatmap, streak
- [ ] Rewards entry row (screen comes in M9)

## M7: Backup and restore
- [ ] Export/import JSON (Replace, Merge by eventId, replay), atomic, round-trip tests
- [ ] Backup reminder banner, standalone-mode warning, data-loss detection

## M8: iPad landscape and offline hardening
- [ ] Sidebar layout, two-pane Session, Library and Stats wide layouts
- [ ] Keyboard shortcuts
- [ ] Offline tests; update prompt; startup budget check

## M9: Gamification and Rewards
- [ ] Goal ring, streak with weekly grace day, XP/levels, about 8 badges, weekly challenge
- [ ] Rewards screen; all optional in Settings

## M10: Confidence calibration
- [ ] Confidence chips, metrics, high-confidence-error flow

## M11: Drills
- [ ] Topic drill, weak-spot mode, confusable-pair drills, extra-practice logging

## M12: Onboarding and placement
- [ ] Interests, pace presets, install guidance; placement quiz (only once enough content)

## M13: New question types
- [ ] estimation, timeline, image, attribution

## M14: Content tooling
- [ ] In-app Draft review, flags export, `apply-decisions`, bulk import (CSV/Anki) with provenance

## M15: Concept graph and constellation map
- [ ] Concept data, related suggestions, concept mastery, map screen

## M16: Light theme
- [ ] Second token set, theme switch, contrast checks

## M17: Read-aloud
- [ ] On-device speech option

## M18: FSRS parameter fitting
- [ ] After >= 1000 reviews

## N1+: Native track (later, outside Claude Code on the web where Xcode is needed)
- [ ] Capacitor wrapper, native haptics/notifications/share, store assets and review
- [ ] Sync (merge by eventId) if desired

## Content track (parallel)
- [ ] 40 verified foundational items per subject by M5
- [ ] About 120 per subject for v1 launch

## Decisions log
(Claude Code appends here: date, decision, reason.)

- 2026-11-23, M0: Kept Preact (SPEC default); no alternative proposed.
- 2026-11-23, M0: TypeScript pinned to 6.0.x, not 7.x. Reason: typescript-eslint 8.x supports `typescript <6.1`. Revisit when it supports 7.
- 2026-11-23, M0: Layering enforced with ESLint (`no-restricted-imports`, `no-restricted-globals`, and a `no-restricted-syntax` rule against `Date.now()` / `new Date()`) plus a DOM-free `tsconfig.core.json`, instead of dependency-cruiser. Reason: no extra dependency, and the TypeScript check also catches indirect DOM use. `src/core/layering.test.ts` proves the rules fire.
- 2026-11-23, M0: Raw colors outside `src/ui/tokens.css` are caught by `src/ui/tokens.test.ts` (no stylelint dependency).
- 2026-11-23, M0: `StorageAdapter` and `ReviewEvent` are provisional interfaces; M2 may refine them with the IndexedDB implementation.
- 2026-11-23, M0: `npm run validate:content` is a stub (checks `content/packs/` and that each pack folder has `pack.json`) until M1. Scripts run with Node's built-in type stripping (Node >= 22.18), so no tsx dependency.
- 2026-11-23, M0: Service worker uses `registerType: 'prompt'` with no prompt UI yet: a new version waits until the app is closed, so updates apply on next launch, never mid-session (SPEC 18). Update prompt in M8. Precache is the app shell only (about 183 KiB); the 512 px icons are left out.
- 2026-11-23, M0: Placeholder icon is a hand-written SVG; PNGs were rendered once with the preinstalled headless browser and committed (no image-tool dependency).
- 2026-11-23, M0: Markdown files are excluded from Prettier so hand-written docs are not reformatted.
- 2026-11-23, M0: `npm audit` reports 4 moderate advisories in glob/minimatch via `vite-plugin-pwa` > `workbox-build`. Build-time only, not shipped to the app; the suggested fix downgrades the PWA plugin, so it is accepted for now. Recheck at M8.
- 2026-11-23, M1: JSON Schemas in `/schema` define the file shapes; `ajv` (dev dependency only) checks them in the scripts. Semantic rules are pure functions in `src/core/content`. The app will trust the CI-validated content index instead of shipping a schema validator.
- 2026-11-23, M1: Question files are objects `{ $schema, questions: [...] }` (not bare arrays) so editors can autocomplete from the schema.
- 2026-11-23, M1: "Retired IDs are never deleted or reused" is enforced with a ledger, `content/ids.json`, updated by `npm run content:register`. The validator fails on IDs missing from content or from the ledger.
- 2026-11-23, M1: Taxonomy node IDs are global; packs may redeclare shared nodes only if identical. Topics may sit under a subject or a branch.
- 2026-11-23, M1: `content-index.json` is generated into `public/content/` (gitignored) by `npm run content:index`, also run as `prebuild`. Serving question files and caching active packs is M5.
- 2026-11-23, M1: Seed packs use accent tokens `gold` (consciousness science) and `link` (philosophy of mind) until dedicated subject accent tokens exist.
- 2026-11-23, M1: Seed pack text is licensed CC-BY-4.0 (original paraphrase with citations). Martin to confirm the license choice.
- 2026-11-23, M1: 20 seed questions (10 per pack, 14 MCQ, 6 recall), foundational. Martin reviewed the list and asked for all 20 to be marked verified (verified_on 2026-11-23). Citations (DOIs and SEP links) could not be opened from the sandbox; recheck them when convenient.
- 2026-11-23, M1: Pack license CC-BY-4.0 confirmed by Martin.
- 2026-11-23, M2: Added `idb` (ISC) for the IndexedDB adapter, `katex` (MIT) loaded lazily only for text containing `$...$`, and `fake-indexeddb` (Apache-2.0, dev only) for storage tests. No UI test library yet; the UI was checked with headless Chromium at iPhone size.
- 2026-11-23, M2: Hash routing (`#/today`, `#/session`, ...), so GitHub Pages and offline navigation need no server rewrites.
- 2026-11-23, M2: Without a scheduler, M2 sessions are practice: review events use `mode: "extra"` and do not affect FSRS later. The M3 Daily queue writes `scheduled` events. Session size 10, verified MCQs only, interleaved by pack.
- 2026-11-23, M2: The `cards` store is a cache rebuilt from the review log by `replayCards` after each answer; the log stays the source of truth.
- 2026-11-23, M2: The in-progress session is saved in the `meta` store after every step and resumed on return (SPEC 8), including after a reload on the feedback screen.
- 2026-11-23, M2: The generated content (index plus verified questions per pack, about 26 KB) is precached with the app shell so a first visit works offline. Content updates apply on next launch, like app updates. M5 narrows this to active packs.
- 2026-11-23, M2: Deferred feedback actions, rather than showing buttons that do nothing: Too easy (M3), Note (M7), Flag (M14), Related (M15). The consequence line ("You'll see this again tomorrow") waits for the scheduler in M3.
- 2026-11-23, M2: If IndexedDB is unavailable (some private modes), the app runs on in-memory storage and shows a warning banner.
- 2026-11-23, M2: New lint rules: no `Math.random` in core (inject `Random`), and `src/ui` must not import `src/platform` (adapters are wired in `src/app`).
