# SPEC.md: Pleiad, a personal spaced-repetition learning app

Status: v0.2 draft, 2026-11-21. Owner: Martin. This file defines WHAT we build. Visual language and screens live in DESIGN.md. Milestones and progress live in PLAN.md. Working conventions for Claude Code live in CLAUDE.md.

"Pleiad" is the working name. Domain, handle and trademark availability are not yet verified.

## 0. Changes from v0.1

- Name: Pleiad (was "Recall").
- Portable architecture: UI-free core, thin platform adapters, so the same logic ships as PWA now and as an App Store / Play Store app later (section 3).
- Content scales to many subjects: taxonomy tree, content packs, lazy loading (section 5).
- Four new question types: estimation, timeline, image, attribution (section 6).
- "Go deeper", related items and personal notes on every explanation (section 10).
- Sync-ready data model, i18n-ready fields, pack license and provenance metadata (sections 5, 19).
- Discovery: Library tree, shelves, learning paths, later a constellation map (section 12).
- Onboarding and placement quiz (section 13), deferred until enough content exists.
- Visual direction fixed: dark-only "night sky" for v1, light theme as a later milestone. iPad is landscape-first (section 17, DESIGN.md).
- Gamification trimmed to about 8 badges; the rewards screen is one tap deep from Stats (section 15).
- Starting content difficulty: foundational first, with automatic unlock of advanced items (section 7).

---

## 1. Purpose

A personal, offline-first learning app that builds durable, even recall across areas of deep interest. It starts with two subjects, **Consciousness science** and **Philosophy of mind**, and must grow to many: science, physics, neuroscience, philosophy (existentialism, cynicism, Stoicism, ethics), leadership, business, history, and reference knowledge such as important numbers. Adding a subject must be a content-only change.

Core promise: the app remembers what I struggle with, resurfaces it at the right time, and shows me where my knowledge is uneven. It should also be beautiful enough that opening it is something I want to do.

### Goals
1. Scientifically grounded scheduling (FSRS), not a home-made heuristic.
2. Low-friction answering: tap-based, very short answers, minimal typing, one-handed on iPhone, comfortable on iPad in landscape.
3. Trustworthy content: every question has a source and a verification status.
4. Beautiful, calm, engaging: dark night-sky design, restrained gamification that never distorts scheduling.
5. Scalable: new subjects are content-only; the codebase can move to native distribution without a rewrite.
6. Private by design: no accounts, no analytics, no API keys in the app.

### Non-goals (v1)
- Accounts, social features, sharing, leaderboards.
- In-app LLM calls or LLM grading. Content is generated offline (section 16).
- Long typed answers.
- Cloud sync (the data model is sync-ready; the feature is a later native-track milestone).
- Light theme (planned, later milestone).
- Non-English UI or content (schema is i18n-ready).

### Audience
Single user (Martin) at first. The data model reserves a `profileId` so multiple profiles can be added later. Whether others will use it is undecided; do not build accounts or multi-user features now.

---

## 2. Product principles

1. **Calm over loud.** No pressure mechanics, no nagging, no streak guilt.
2. **Browse like a library, study like a ritual.** Discovery is shelves and a tree; daily study is one big button.
3. **Honest feedback.** Show what was right, what the user chose, why, and the source.
4. **Even knowledge.** Surface weak areas without shaming (coral for weak, never red alarms).
5. **Restraint with the sky metaphor.** Sky vocabulary appears on the Today hero, the map and the icon. Elsewhere use plain words (questions, topics, review).
6. **Scale by content.** If a feature needs a code change per subject, redesign it.

---

## 3. Architecture and platform roadmap

### 3.1 Delivery path
1. **Now:** installable PWA (iPhone, iPad, desktop browser for development).
2. **Later:** wrap the same web app with Capacitor for App Store and Play Store distribution. Reasons: App Store presence and sharing, more reliable storage, later sync.
3. **Not planned:** rewriting in Swift or Kotlin. If ever needed, the UI-free core (3.2) is the part that must remain portable.

Risks to plan for: Apple guideline 4.2 (minimum functionality) can reject thin web wrappers, so the native build should add real native value (local notifications, haptics, share sheet, widgets later). iOS builds require macOS and Xcode; that is out of scope for Claude Code on the web and is handled later on Martin's own machine or a CI macOS runner.

### 3.2 Layering (enforced by directory structure and lint rules)
```
/src
  /core            # pure TypeScript, NO DOM, NO browser APIs, NO UI imports
    scheduler/     # Scheduler interface + FSRS adapter
    content/       # schema types, validators, pack/taxonomy loaders (parse only)
    session/       # queue construction, rating mapping, answer normalization
    analytics/     # mastery, weak spots, calibration, streaks
    gamification/  # XP, levels, badges, challenges (pure functions)
    sync/          # event log model, merge, replay
  /platform        # adapters, one interface each, web implementation now
    storage/       # StorageAdapter (IndexedDB now; SQLite later)
    haptics/       # no-op on web
    notifications/ # no-op on web; local notifications on native later
    share/         # export/import file handling
    clock/         # injectable clock
  /ui              # Preact components, screens, design tokens; talks to core via hooks
  /app             # composition root, routing, service worker registration
```
Rules:
- `core` imports nothing from `platform` or `ui`. `platform` implements interfaces declared in `core`.
- All time comes from the injectable clock. No `Date.now()` in `core`.
- All persistence goes through `StorageAdapter`. UI never touches IndexedDB directly.
- Each rule has an automated check (ESLint import restrictions or a dependency-cruiser config) added in M0.

### 3.3 Sync-ready data model (no sync feature in v1)
- The review log is append-only; every event has `eventId` (UUID or ULID), `deviceId`, `profileId`, `ts` (UTC).
- Card state is always derivable by deterministic replay of the log (section 19).
- No feature may depend on mutable server state.

### 3.4 i18n-ready
- UI strings live in one resource file keyed by ID, not inline in components.
- Question fields allow a `lang` and a `translations` map later; v1 ships English only. Do not build translation UI.

---

## 4. Stack

- **Language/tooling:** TypeScript (strict), Vite, Preact by default (Claude Code may propose an alternative with a short written rationale in CLAUDE.md). Vitest. ESLint and Prettier.
- **Storage:** IndexedDB via `idb` behind `StorageAdapter`.
- **Scheduler:** an open-source FSRS implementation in TypeScript (for example `ts-fsrs`). Claude Code verifies package name, license, maintenance status and API before adopting, and wraps it behind our own `Scheduler` interface.
- **Math:** KaTeX, lazy-loaded only for questions that contain LaTeX.
- **PWA:** service worker and manifest (for example `vite-plugin-pwa`).
- **Fonts:** self-hosted (for example via `@fontsource`), never loaded from a third-party CDN at runtime (section 20 forbids third-party calls).
- **Hosting:** public GitHub repo, GitHub Actions to GitHub Pages. Because the repo and site are public, **never commit source PDFs, copyrighted text, secrets or personal data**. Questions are paraphrased with citations only.
- **Build environment:** development happens in Claude Code on the web. Everything must build and test headlessly with `npm ci && npm test && npm run build`. Nothing in the core toolchain may require macOS or Xcode.

---

## 5. Content model

### 5.1 Taxonomy (tree)
Knowledge is organized as a tree with four levels:

`domain > subject > branch > topic`

Example: `Philosophy > Existentialism > Sartre > Bad faith`; `Science > Neuroscience > Consciousness science > Integrated Information Theory`.

Depth is flexible (a subject may have no branches) but questions attach to a **topic** (leaf). Display rules: the Library shows domains and subjects as shelves; drill-down shows branches and topics as an expandable list (see DESIGN.md).

### 5.2 Packs
A **pack** is the unit of content distribution and licensing.

```
/content
  /packs
    /<pack-id>/
      pack.json            # metadata (below)
      taxonomy.json        # nodes added or extended by this pack
      questions/<topic>.json
      concepts.json        # optional (section 11)
      media/...            # self-authored or licensed images only
/schema
  pack.schema.json
  question.schema.json
  taxonomy.schema.json
/scripts
  validate-content.ts
  build-content-index.ts   # generates content-index.json (counts, tree, pack sizes)
```
`pack.json`: `id`, `title`, `description`, `version`, `language`, `author`, `license`, `provenance` (how items were created, for example "Claude-drafted, verified by Martin"), `created`, `domainPath` (where it attaches in the tree), `accent` color token.

Adding a subject = adding a pack folder. No code change.

### 5.3 Lazy loading
- A small generated `content-index.json` (tree, counts, pack sizes, versions) loads at startup.
- Question files load on demand, per pack or per topic, when the user starts that subject or a session needs it, then cache in the service worker.
- Precache budget: the app shell plus content index plus the user's active packs. Do not precache all packs (iOS cache limits). Active packs are cached on activation and when a new version appears.
- Starting a subject in the Library "activates" it (setting `activePacks`); the Daily queue draws only from active packs.

### 5.4 Question schema (all types)
| Field | Required | Notes |
|---|---|---|
| `id` | yes | Globally unique, stable, never reused (for example `cons-iit-0042`). |
| `pack` | yes | Pack ID. |
| `topic` | yes | Taxonomy leaf ID. |
| `type` | yes | See section 6. |
| `tier` | yes | `foundational`, `advanced`, `expert`. |
| `tags` | yes | Free tags (`iit`, `contrast`, ...). |
| `prompt` | yes | Markdown plus inline LaTeX (`$...$`). |
| `explanation` | yes | 1 to 3 sentences shown after answering. |
| `sources` | yes (>=1) | `[{ citation, url? }]`. Primary literature preferred. |
| `status` | yes | `draft`, `verified`, `retired`. Only `verified` enters reviews. |
| `deeper` | no | "Go deeper" content: `{ text?, links?[], furtherReading?[] }`. Short; links are citations, not copied text. |
| `media` | no | `[{ src, alt, credit?, license? }]`. |
| `confusable_with` | no | IDs of easily confused items. |
| `concepts` | no | Concept IDs. |
| `prerequisites` | no | Question or concept IDs. |
| `lang` | no | Default `en`. |
| `created`, `verified_on` | yes/auto | ISO dates. |

### 5.5 Content rules (validator enforces what is mechanical)
- Schema validity, unique IDs, valid pack and topic, at least one source, `verified` requires `verified_on`.
- Near-duplicate prompt detection (warn).
- MCQ: exactly one correct option, no "all/none of the above", distinct distractors.
- Referential integrity for `confusable_with`, `concepts`, `prerequisites`, taxonomy parents.
- Retired IDs are never deleted or reused.
- Media: alt text required; `license` required for anything not self-authored.
- Editorial guidelines (reviewed by a human): one concept per item, unambiguous stem, distractors drawn from real alternative positions.
- **Contested fields** (consciousness science, philosophy): attribute claims ("According to IIT...", "Chalmers argues...") rather than asserting disputed positions as fact.
- If an item's correct answer changes materially, retire it and create a new ID.

### 5.6 Validation in CI
`npm run validate:content` fails the build on any violation and prints a report (counts by pack, topic, tier, type, status).

### 5.7 Licensing and provenance
Every pack declares a license and provenance. The repo is public, so packs are either original (paraphrase plus citation) or explicitly licensed. Bulk imports (section 16) must record their origin and license in `pack.json`. No copyrighted passages.

---

## 6. Question types

All types: tap-first, answer area anchored to the bottom of the screen (phone) or in the answer pane (iPad), immediate feedback with explanation and source, then Continue. Keep answers very short; avoid typing.

| Type | Interaction | Notes |
|---|---|---|
| `mcq` | 4 to 5 option buttons | `options[{text, why_wrong?}]`, `answer` index; options shuffled at display. |
| `recall` | think, reveal, rate (Again / Hard / Good / Easy) | `answer_text` short model answer. No typing. |
| `short` | one short field, or dictation | One word, short term or number; normalized comparison; "I was right" and "I was wrong" overrides after reveal. iOS keyboard dictation must work. |
| `cloze` | tap blank, tap chip | `text` with `{{blank}}`, `bank[]` with distractors; correct only if all blanks correct. |
| `match` | tap pairs | `pairs[]`; wrong pair counts as an error. |
| `order` | tap in sequence | `items[]` in correct order, shown shuffled. |
| `estimation` | pick a range or move a log-scale slider | Fields: `value`, `unit`, `scale: linear|log`, `bins[]` or `tolerance`. For "important numbers" (for example the number of neurons in the human cortex, orders of magnitude). Correct if within tolerance; feedback shows the true value and how far off the guess was. |
| `timeline` | place events on a line, or order by date | Fields: `events[{label, date}]`, `precision`. Correct if order is right and each within tolerance. |
| `image` | image prompt, then MCQ, label-tap or hotspot | Fields: `media[]` (alt text required), `mode: mcq|hotspot|label`, `hotspots[{x, y, r, label}]`. Image must be self-authored or licensed. |
| `attribution` | "Who argued / said / discovered this?" | Same mechanics as MCQ with options drawn from a `thinkers` list; optionally links to a thinker entity for "more from this thinker" shelves. |

Behavior notes:
- **Short** normalization: case, whitespace, diacritics, simple plurals, accepted variants, numeric tolerance.
- **Estimation** and **timeline** map to FSRS ratings like other auto-graded types (section 7.3), using tolerance bands instead of exact correctness.
- **Image** and **attribution** are variants and reuse the MCQ engine where possible.
- Each type ships in its own milestone (PLAN.md); only mcq and recall are needed to start.

---

## 7. Scheduling (FSRS)

### 7.1 Core
- FSRS via the `Scheduler` interface. Per-card state (stability, difficulty, due, reps, lapses, last review, state) stored via `StorageAdapter`.
- **Desired retention:** default 0.90, adjustable 0.80 to 0.95.
- **Daily limits:** new items per day default 10 (0 to 50); review cap default 150 (soft cap).
- **Day boundary:** 04:00 local time. Store UTC timestamps; time zone changes must not corrupt due dates.
- **Determinism:** scheduler logic is pure and unit-tested with a fixed clock.

### 7.2 Starting difficulty and unlock
- New-item tier mix default: **foundational-first ramp**, 60% foundational, 30% advanced, 10% expert. Adjustable in Settings.
- **Auto-unlock:** advanced items of a topic are introduced once at least 80% of that topic's foundational items have been introduced; expert items once 80% of advanced have been introduced. Setting "Unlock automatically" is on by default; the user may unlock a tier manually per topic.
- Prerequisites (`prerequisites` field) gate introduction of an item until the prerequisite item or concept has been introduced.

### 7.3 Answer-to-rating mapping
- Recall: user chooses the rating.
- Auto-graded types: incorrect = Again; correct = Good; correct but "Guess" or very slow (default 3x the median response time for that tier) = Hard; Easy only via an explicit "Too easy" button on the feedback screen.

### 7.4 Leeches
Items with >= 6 lapses are flagged, leave the normal queue ramp-up after review, and appear in the weak-spot view with suggestions to rewrite, split, or add a confusable-pair drill.

### 7.5 Queue construction (Daily queue)
Due reviews first, then new items up to the daily limit, interleaving subjects and question types rather than blocking by topic.

### 7.6 Extra practice
Items practiced when not due (drills) are logged with `mode: extra`. They **do not change FSRS state**; a miss feeds the weak-spot score.

### 7.7 Parameter fitting
FSRS default parameters in v1. Personal fitting is a later milestone once >= 1000 reviews exist; the review log must support replay.

---

## 8. Session modes

1. **Daily queue** (primary): 5 to 15 minute sessions, progress bar, a clear "done for today" state. One big Start button on Today.
2. **Topic drill:** filter by subject, branch, topic, tag, tier. Due items follow normal scheduling; others are extra practice.
3. **Weak-spot mode:** drills the weak-spot list (section 14.2).
4. **Confusable-pair drills:** contrast items via `confusable_with` (section 10.3).
5. **Learning paths** (later): ordered sequences of topics (for example "Philosophy of mind from scratch"), defined in pack metadata.

Sessions can be interrupted and resumed; state survives app suspension.

---

## 9. Confidence calibration (optional, on by default for MCQ and short)

- Before answering the user taps **Guess**, **Fairly sure** or **Certain**. Stored with each review event.
- Metrics: Brier score, calibration curve, over/underconfidence index, by subject and tier.
- **High-confidence errors** (Certain and wrong) are prioritized in the weak-spot list and get a "Why was I confident?" card.
- Calibration changes FSRS ratings only via the "Guess" downgrade (7.3).

---

## 10. Learning features

### 10.1 Tiers
Filters, new-item mixes and mastery stats use the tier.

### 10.2 Explanation card
After each answer: the correct answer, the user's answer if different, a short "Why", the source, and these actions: **Go deeper**, **Related**, **Flag**, **Note**.
- **Go deeper:** expands `deeper` content and links.
- **Related:** items sharing a concept or marked confusable; in-session "one more like this" after a miss.
- **Note:** a short personal note attached to the question, stored on-device, included in export.
- **Flag:** marks the item as wrong or unclear, with an optional note (section 16).

### 10.3 Confusable-pair drills
Items link via `confusable_with` (for example IIT vs GWT). Authors create contrast items as ordinary MCQs tagged `contrast`.

### 10.4 Concept of the day
One rotating concept card on Today, drawn from the user's active subjects; tapping it opens a short explainer with sources and a link into the related topic.

---

## 11. Concept graph and constellation map

- `concepts.json` in a pack: nodes `{id, label, summary?, topic?}` and edges `{from, to, relation}` with relation in `prerequisite`, `related`, `contrasts_with`, `part_of`.
- Questions reference concepts; concept mastery aggregates its questions.
- **Phased delivery:**
  1. Related and prerequisite suggestions after a miss.
  2. Concept-level mastery in Stats.
  3. **Constellation map:** a visual map where each subject is a constellation of topics (stars). Lit stars are topics the user has started; brightness reflects retention. Tapping a star opens the topic. The Today hero uses a simplified version of this.
- The validator checks referential integrity and flags orphan concepts.

---

## 12. Discovery and navigation

Four ways to find content, all driven by the taxonomy and pack metadata:
1. **Library tree:** domain shelves, subject pages, expandable branches (DESIGN.md).
2. **Shelves:** Continue, Due today, per-domain rows, and later "Learning paths".
3. **Search:** by topic, thinker, tag.
4. **Map:** constellation map (later, section 11).

Navigation: iPhone bottom tab bar (Today, Practice, Stats, Library, Settings). iPad landscape: sidebar plus detail pane (section 17). Rewards are one tap deep from Stats, not a tab.

---

## 13. Onboarding and placement

- **First run:** welcome, pick interests (active packs), pick pace (relaxed, steady, intense: preset daily new items and goal), install guidance (section 18).
- **Placement quiz:** a short adaptive check per chosen subject to set the starting tier mix. **Deferred** until at least about 60 verified items exist in a subject; until then use the foundational-first default. Skippable.

---

## 14. Progress and analytics

All analytics derive from the append-only review log plus card state. No external services.

### 14.1 Mastery
- **Retention estimate:** mean FSRS retrievability across started verified items.
- **Coverage:** percent of verified items introduced.
- Shown per subject, branch, topic, tag and tier, sortable to reveal unevenness (the key goal). Weak areas use the coral accent.

### 14.2 Weak-spot list
Ranked score combining recent lapses, low retrievability, leech status, high-confidence errors and extra-practice misses. Each entry links to its question and concept. One-tap "Drill these".

### 14.3 Streaks and calendar
Heatmap of activity, current and longest streak, goal history.

### 14.4 Review log (source of truth)
Append-only events: `{eventId, profileId, deviceId, cardId, ts (UTC), mode (scheduled|extra), type, correct, rating, responseMs, confidence?, schedulerStateBefore, schedulerStateAfter, appVersion}`.

---

## 15. Gamification (restrained, optional)

Principle: a little interaction and polish, never pressure. Everything can be turned off. Nothing affects scheduling or ratings. Everything lives one tap deep from Stats ("Rewards"), except the Today goal ring and streak.

- **Daily goal:** default 20 reviews; progress ring on Today; a short completion moment (a star lights in the hero).
- **Streak:** days meeting the goal, with **one free grace day per week**.
- **XP and level:** XP per correct answer scaled by tier (1, 2, 3), small bonus for correct high-confidence answers and for recovering weak items. A global level with a title (for example "Stargazer") and per-subject titles.
- **Badges:** about 8, milestone-based (first 100 reviews, 7-day streak, first subject at 80% retention, 10 weak items recovered, first well-calibrated week, and similar).
- **Weekly challenge:** one deterministic challenge per week with a modest XP reward.
- **Polish:** subtle transitions, animated progress ring, restrained celebration, concept-of-the-day card. Respect `prefers-reduced-motion`.
- **Out of scope:** leaderboards, loss-aversion nagging, push notifications, sound, purchasable items.
- **Haptics:** not available in the PWA (unreliable on iOS web); enabled in the native wrapper through the `haptics` adapter.

---

## 16. Content pipeline (offline)

1. **Source intake:** Martin supplies sources (excerpts, titles/DOIs, notes) in a Claude chat or Claude Code. Source files are not committed; only citations are.
2. **Drafting:** Claude produces questions as JSON matching the schema with `status: draft`, sources, tier, tags, explanation and, where useful, `deeper`. Contested topics use attributed phrasing.
3. **Validation:** `npm run validate:content`.
4. **Human verification (quality gate):**
   - Path A (v1): Martin reviews drafts and asks Claude Code to flip specified IDs to `verified` and set `verified_on`.
   - Path B (later): in-app Draft review mode (Approve / Reject / Needs edit), export `review-decisions.json`, apply with `npm run apply-decisions`.
5. **Flags:** in-app "Flag as wrong/unclear", stored locally and exported as `flags.json`.
6. **Bulk import:** a script converts CSV or Anki-style exports to draft questions in a new pack, recording origin and license in `pack.json`. Imported items are `draft` until verified.
7. **Targets:** first usable milestone >= 40 verified items per v1 subject, mostly foundational; v1 launch about 120 per subject with tiers roughly 50/35/15 (adjustable later) and >= 15% contrast items.
8. **Suggested v1 topic coverage (editable):**
   - *Consciousness science:* IIT, global workspace, higher-order theories, recurrent processing, predictive processing and active inference, attention schema, illusionism, neural correlates and contrastive methods, perturbational measures, disorders of consciousness and anesthesia, animal and machine consciousness.
   - *Philosophy of mind:* dualisms, physicalisms, functionalism, qualia and thought experiments (Mary, zombies, inverted spectrum), the hard problem, intentionality, mental causation, panpsychism, personal identity, extended mind, Chinese room.

---

## 17. User experience (summary; details in DESIGN.md)

- **Look:** dark-only "night sky" theme in v1, with a luminous gold accent, quiet and elegant. A light theme is a later milestone (PLAN.md M16); design tokens must make it possible without touching components.
- **iPhone (portrait):** bottom tab bar; answer controls in the bottom third; tap targets >= 44 pt; no gestures required; safe-area aware.
- **iPad (landscape-first):** sidebar navigation; in a session a two-pane layout (question and answers on the left, explanation, source and related on the right, which stays visible after answering); Stats and Library use the width (for example a subject list beside its detail). Portrait iPad falls back to the phone layout with larger sizes. Hardware keyboard shortcuts (1 to 5 select option, Space reveal/next, 1 to 4 rating).
- **Accessibility:** VoiceOver labels, no information by color alone (icons and labels accompany gold/coral), Dynamic Type respected, reduced-motion support, AA contrast on the dark theme.
- **Read-aloud audio:** later milestone, on-device Web Speech, English only.

---

## 18. PWA and iOS specifics

- **Install:** manifest with `display: standalone`; first-run screen explains Share > Add to Home Screen.
- **iOS storage:** Safari removes script-writable storage after seven days without interaction for ordinary sites, but not for apps added to the Home Screen, which have their own usage counter; storage is separate between Safari tabs and the installed app. Therefore: **install first, then study only in the installed app**, and show a warning when running in a browser tab. Request `navigator.storage.persist()` where supported, but never rely on it.
- **Offline:** service worker precaches the shell, content index and active packs; versioned content; an "Update available" prompt applies updates on next launch, never mid-session.
- **Startup budget:** first meaningful screen < 1 s on a recent iPhone from cache.

---

## 19. Data, backup and sync-readiness

- **Stores:** `cards`, `reviews` (event log), `settings`, `notes`, `flags`, `meta` (device ID, profile ID, schema version, last backup).
- **Export:** one-tap JSON containing the review log, notes, settings, flags and `schema_version`, via the share sheet or Files.
- **Import:** Replace and Merge. Merge unions events by `eventId`, then rebuilds card state by deterministic replay. Atomic (all-or-nothing). Round-trip tested.
- **Backup reminder:** banner when the last export is older than 7 days (no push).
- **Data-loss detection:** if the database is empty but meta indicates prior use, prompt "Restore from backup".
- **Migrations:** versioned with tests; older exports import into newer versions.
- **Sync later:** the same merge-by-eventId and replay logic is the basis of cross-device sync in the native track; no sync code in v1.

---

## 20. Quality, testing and CI

- **Unit tests (required):** scheduler wrapper (fixed clock), answer normalization, queue construction and tier unlock, rating mapping, calibration metrics, XP/streak logic, export/import round trip, migrations, content validator, layering rules.
- **Smoke tests (later):** one session flow per question type.
- **CI on every push:** typecheck, lint (including layering rules), unit tests, content validation, build. Deploy to GitHub Pages only from `main` on green.
- **Budgets:** answer-to-next-question latency < 100 ms; core JS < 150 kB gzipped excluding KaTeX and packs.
- **Privacy and security:** no analytics, no third-party runtime network calls (including fonts), no secrets or keys in the repo or app.

---

## 21. Milestones

See PLAN.md for the detailed checklist. Overview:

| # | Milestone |
|---|---|
| M0 | Scaffolding, CI, Pages deploy, PWA shell, layering rules, design tokens |
| M1 | Content model, taxonomy, packs, validator, seed questions |
| M2 | App shell, navigation, MCQ session and feedback screen, storage, review log |
| M3 | FSRS and Daily queue |
| M4 | Recall, short, cloze, match, order |
| M5 | Library: tree, subject pages, pack activation, lazy loading |
| M6 | Stats: mastery, weak spots, heatmap |
| M7 | Backup and restore, standalone warning |
| M8 | iPad landscape layout and offline hardening |
| M9 | Gamification and Rewards |
| M10 | Confidence calibration |
| M11 | Topic, weak-spot and confusable drills |
| M12 | Onboarding and placement |
| M13 | New question types: estimation, timeline, image, attribution |
| M14 | Draft review mode, flags, bulk import |
| M15 | Concept graph and constellation map |
| M16 | Light theme |
| M17 | Read-aloud |
| M18 | FSRS parameter fitting |
| N1+ | Native track: Capacitor wrapper, haptics, notifications, store submission, sync |

Content authoring runs in parallel from M1.

---

## 22. Decisions and open items

**Decided**
- Name: Pleiad (working), pending domain and trademark checks.
- PWA first, Capacitor later; UI-free core and platform adapters.
- Dark-only v1; light theme later. Sky vocabulary used lightly.
- iPad used mainly in landscape: landscape-first iPad layout.
- Starting content is foundational-first with automatic unlock; tiers editable later.
- Single user; no sharing; English only; no accounts.
- Questions are drafted later, in parallel with development, and verified by Martin.

**Open**
1. Domain, social handle and trademark for "Pleiad".
2. FSRS library choice (verified at M3).
3. Whether other people will use the app (affects onboarding polish and a future license).
4. Apple Developer account and macOS access for the native track.

## 23. Risks

- **iOS storage eviction and Safari/standalone split:** standalone install, warning, export format, reminders.
- **Question accuracy in contested fields:** sources, verified gate, attributed phrasing, flags.
- **Scope creep:** strict milestone order, one milestone per Claude Code session.
- **App Store rejection of a thin wrapper:** add real native features before submission.
- **Content scale versus iOS cache limits:** lazy-loaded packs, precache only active packs.
- **Library churn:** scheduler behind an interface.
