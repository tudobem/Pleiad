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
- [x] Verify FSRS library (license, maintenance, types); record choice below
- [x] `Scheduler` interface and adapter; fixed-clock tests
- [x] Daily queue: due first, new up to limit, 04:00 day boundary, interleaving, tier mix and auto-unlock
- [x] Today screen with Start button and counts

## M4: More question types
- [x] recall, short (with normalization and overrides), cloze, match, order
- [x] Rating mapping and tests per type

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
- 2026-11-24, M3: FSRS library: `ts-fsrs` 5.4.2 (MIT, open-spaced-repetition, no runtime dependencies, Node >= 18). Not 6.x yet: 6.0.0 was 4 weeks old and 6.0.1 two days old at the time, and 6.x requires Node >= 24 and adds a dependency. 5.x adds four deprecated helpers to `Date.prototype` on import; harmless, removed when we move to 6.x together with Node 24.
- 2026-11-24, M3: FSRS runs with default parameters (SPEC 7.7), fuzz off (exact, deterministic replay) and short-term steps off: no minute-level relearning inside a session; a missed item returns on a later day. Revisit after real use.
- 2026-11-24, M3: `src/core/scheduler/fsrsScheduler.ts` is the only module importing ts-fsrs; everything else uses our `Scheduler` interface and a JSON `SchedulerState` with UTC ms timestamps.
- 2026-11-24, M3: The 04:00 day boundary uses the local UTC offset at query time only (`Clock.utcOffsetMinutes`); stored times stay UTC, so a time-zone change never rewrites due dates.
- 2026-11-24, M3: Replay recomputes FSRS from each scheduled event's rating and timestamp; `schedulerStateBefore/After` in events are kept for audit but not trusted. Extra practice never changes FSRS state.
- 2026-11-24, M3: A review event is now committed when leaving the feedback screen (Continue or Too easy), with `ts` = the time the answer was checked, so "Too easy" can rate Easy without editing the append-only log. A pending answer in a saved session is committed on resume, or when an earlier day's session is closed. Saved M2 sessions are discarded.
- 2026-11-24, M3: The whole Daily queue is one session (due reviews, then new items), resumable the same day. New items are shuffled with a seed from the learning day, so the queue is stable within a day. "Practice anyway" starts a 10-item extra session when nothing is due.
- 2026-11-24, M3: Slow answers (rated Hard when correct) use 3x the per-tier median of scheduled response times, only once a tier has 10 samples. Settings (new per day 10, review cap 150, retention 0.90, tier mix 60/30/10, auto-unlock on) have defaults and clamping in core; the Settings screen comes later.
- 2026-11-26, M4: New content fields: `short.answers` (first canonical, rest accepted variants) and optional `numeric {value, tolerance}`; `cloze.text` with blanks written as `{{answer}}` plus `bank` of distractor chips; `match.pairs [{left, right}]` (3 to 6); `order.items` in correct order (3 to 6). Content index version 2.
- 2026-11-26, M4: Short answers ignore case, whitespace, punctuation and accents; plurals match word by word (`zombies` = `zombie`, `theories` = `theory`) rather than by stemming; numbers accept `1,000`, `1 000`, `1.5` and `1,5` within the stated tolerance. "I was right / I was wrong" overrides the auto-grade before the review is saved.
- 2026-11-26, M4: Recall: "Show answer", then four rating buttons that show the resulting interval in scheduled sessions; the chosen rating is logged as is (SPEC 7.3). A recall answer that was shown but never rated is not logged.
- 2026-11-26, M4: Match and order count as correct only when every pair or position is right; feedback marks each part and shows the right answer. Order questions are never shown already in the correct order.
- 2026-11-26, M4: Session items store a generic `layout` (the shuffled display order per type) and a typed `response`; sessions saved by M3 are migrated rather than discarded. The Daily queue now interleaves question types as well as subjects.
- 2026-11-26, M4: 16 new questions (2 per new type per pack) added as drafts; Martin named all 16 IDs and they were marked verified (verified_on 2026-11-26). Citations could not be opened from the sandbox. All six types were exercised end to end on a local test build where the drafts were marked verified (not committed).
- 2026-11-26, CI: Two deploys in a row failed because GitHub listed the fresh Pages artifact a few seconds late ("No artifacts named github-pages"). The deploy job now waits until the artifact is listed (up to about 2 minutes, needs `actions: read`) and retries `deploy-pages` once after 30 seconds. Re-running a failed deploy job inside the same run still fails (it finds two artifacts); start a new run instead.
- 2026-11-26, review of PRs #7 and #8: Finding: if a session was paused on a feedback screen and its question was then retired, closing that session dropped the pending answer. Fix: `commitPending` now logs the answer from what the answer record holds (question ID and response type) when the question is no longer served; only the tier-based slow rule is skipped, since the tier is unknown. A recall answer shown but never rated is still not logged. Tests cover retired, previous-day and practice sessions.
- 2026-11-26, review of PRs #7 and #8: Taxonomy nodes get an optional integer `order` (schema, types, content index). Siblings sort by `order` ascending, then unordered nodes by label ignoring case (so "meta-d'" no longer sorts after "Z"), then ID. Duplicate sibling orders are a validator warning, not an error, because label order breaks the tie; shared nodes must agree on `order`. The index only includes `order` when set, so its format version is unchanged.
- 2026-11-26, after merging PRs #7 and #8: Set `order` on every branch and topic of both taxonomies to its existing position in the taxonomy file, which is the authored (chapter or chronological) order, so the index lists History as Antiquity, experimental psychology, cognitive revolution, 1988 to 1996, 2004 to 2025. Only `order` was added; no labels, IDs or questions changed. Domains and subjects keep alphabetical order.
- 2026-11-26: Martin verified the Chapter 3 questions; the 25 items in `phenomenology-method` (14), `heterophenomenology` (3) and `introspection-reliability` (8) were marked verified (verified_on 2026-11-26). The 5 new-format extras for Chapters 1 and 2 (`cons-hist-testing-0007`, `cons-hist-early-0007`, `pom-hard-problem-0004`, `pom-hard-problem-0005`, `pom-zombies-0005`) are not Chapter 3 and stay draft until Martin names them.

