# PLAN.md: Pleiad milestones

Status legend: [ ] open, [x] done. One milestone per Claude Code session. At the start of each session: read CLAUDE.md, SPEC.md (relevant sections), DESIGN.md (relevant screens), and this file; enter plan mode; propose steps; then implement. At the end: tick the boxes, record decisions below, commit.

Definition of done for every milestone: `npm ci && npm test && npm run build` pass locally and in CI; new logic has unit tests; layering rules pass; no new third-party runtime requests; PLAN.md updated.

## M0: Scaffolding
- [ ] Vite + TypeScript strict + Preact + Vitest + ESLint + Prettier
- [ ] Directory layout from SPEC section 3.2 with import-restriction lint rules for `core`
- [ ] Injectable clock; `StorageAdapter` interface (no implementation yet)
- [ ] `src/ui/tokens.css` from DESIGN.md; self-hosted Fraunces and Inter
- [ ] PWA manifest + service worker shell; installable
- [ ] GitHub Actions: typecheck, lint, test, build; deploy to Pages from `main`
- [ ] Placeholder icon; README with install instructions for iPhone/iPad

## M1: Content model
- [ ] Types and JSON schemas: pack, taxonomy, question (mcq, recall to start)
- [ ] `validate-content.ts` and `build-content-index.ts`; `npm run validate:content` in CI
- [ ] Two seed packs (Consciousness science, Philosophy of mind) with about 10 placeholder foundational questions, clearly marked `draft` or sample
- [ ] Tests for validator rules

## M2: Shell, MCQ session, storage
- [ ] Routing, tab bar (phone), five screens as stubs
- [ ] IndexedDB `StorageAdapter`; cards, reviews, settings, meta; migrations framework
- [ ] MCQ session UI and feedback screen per DESIGN 4.2 and 4.3
- [ ] Review log written for every answer (eventId, deviceId, profileId)

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
