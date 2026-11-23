# DESIGN.md: Pleiad visual language and screens

Status: v0.1, 2026-11-21. Derived from the approved mockups ("night sky" for Today and Session, "shelves" for the Library). Mockups are reference, not pixel specs; sample numbers and names in them are fake. SPEC.md defines behavior; this file defines look and layout.

## 1. Direction

A luminous, quiet night sky. Dark only in v1. Editorial typography (serif headings), generous spacing, one warm accent. Inspirations: Apple Podcasts and Netflix for browsing and shelves, NYT/WaPo for typographic calm. Anti-references: heavy gamification (Imprint), cluttered dashboards (Amazon).

Sky vocabulary is used sparingly: the Today hero (stars lit), the icon, and later the constellation map. Everywhere else, use plain words.

## 2. Design tokens

Implement as CSS custom properties in one file (`src/ui/tokens.css`). Components never use raw hex values. A later light theme must only need a second token set.

### Color
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B1020` | App background |
| `--bg-glow-a` | `#2b1f3f` | Top radial glow on Today and Session |
| `--bg-glow-b` | `#2a1f5c` | Top radial glow on Library and subject pages |
| `--text` | `#EAF0FF` | Primary text |
| `--text-muted` | `#A9B4D0` | Secondary text |
| `--text-dim` | `#7C88AA` | Tertiary, unselected options after answering |
| `--gold` | `#F2C879` | Primary action, correct, progress fill |
| `--gold-text` | `#FFE9B8` | Text on gold-tinted surfaces |
| `--on-gold` | `#1A1530` | Text on solid gold buttons |
| `--coral` | `#FF8A7A` | Weak area, wrong answer |
| `--coral-text` | `#FFC9C0` | Text on coral-tinted surfaces |
| `--track` | `#2A3566` | Progress track, inactive stars |
| `--link` | `#C3CBFF` | Text buttons and links |
| `--surface` | `rgba(255,255,255,0.06)` | Cards |
| `--border` | `rgba(255,255,255,0.12)` | Card and divider borders |
| `--gold-tint` | `rgba(242,200,121,0.14)` | Correct / selected option fill |
| `--coral-tint` | `rgba(255,138,122,0.12)` | Wrong option fill |

Rules: gold means "go" and "correct"; coral means "needs attention", never an alarm. Never rely on color alone: pair with an icon (check, cross) and a label (CORRECT, YOURS).

### Type
- Headings: **Fraunces** 600 (self-hosted). H1 26 to 34 px, section titles 20 to 22 px.
- Body and UI: **Inter** 400/500/600 (self-hosted). Body 14 to 15 px, captions 12 to 13 px, overline labels 11 px with 0.08 to 0.12 em tracking in caps.
- Respect Dynamic Type and user text-size settings; test at the largest sizes.

### Shape, space, motion
- Buttons: height 52 to 54 px, fully rounded (radius 26 to 27 px). Option rows: min height 46 px, radius 14 px. Cards: radius 20 px.
- Minimum tap target 44 px. Screen padding 24 px on phone. Spacing scale 4, 8, 12, 16, 24, 32.
- Motion: 150 to 250 ms ease-out for transitions; star twinkle on the Today hero is slow and subtle (4 to 8 s loops). Everything respects `prefers-reduced-motion` (replace with instant or fade).

### Iconography
Simple 2 px stroke line icons, rounded caps. No emoji anywhere in the UI.

## 3. Layout system

### iPhone (portrait)
Single column, bottom tab bar (Today, Practice, Stats, Library, Settings), safe-area aware. Primary actions anchored to the bottom third.

### iPad (landscape-first)
- Persistent left **sidebar** (about 280 px): app name, the five destinations, and below them the active subjects with their progress.
- **Content area** uses the width:
  - Today: hero constellation and Start button on the left, concept of the day and goal ring on the right.
  - Session: two panes. Left: progress, question, answer controls. Right: explanation, source, Go deeper and Related, empty-state ("Answer to see why") before answering, and visible after answering so the reader doesn't lose the question.
  - Library: shelves on the left two thirds, selected subject detail on the right.
  - Stats: topic bars on the left, weak spots and heatmap on the right.
- Portrait iPad: use the phone layout with larger type and padding, plus the sidebar collapsed to a tab bar.
- Hardware keyboard shortcuts as in SPEC section 17.

## 4. Screens

Each screen is described by purpose, content and key behavior. All numbers in mockups are sample data.

### 4.1 Today (night sky)
- Top: greeting-free header, small streak and goal ring.
- Hero: a constellation illustration (SVG) for the user's current subject, caption like "Philosophy of Mind · 6 of 11 stars lit". Each star is a topic; lit = started; brightness = retention. Subtle twinkle.
- One big gold button: **Start today's session** (shows count, for example "24 due, 6 new" as a caption below).
- **Concept of the day** card.
- States: nothing due ("You're done for today", with an optional "Practice anyway" secondary action); first run (empty constellation with "Pick your first subject").

### 4.2 Session (question)
- Top bar: close (X, 44 px), thin gold progress bar, "7 / 12".
- Question text in large readable type; math via KaTeX.
- Options: A to D buttons, one per row, min 46 px; selected = gold border and tint.
- Confidence chips (Guess, Fairly sure, Certain) above the answer area when enabled; remembered selection between questions.
- Answer area pinned to the bottom third on phone. Other question types: bank chips for cloze, tap-to-pair for match, numbered taps for order, reveal button then four rating buttons for recall.

### 4.3 Answer feedback
- Result header: "Correct" or "Not quite" with a one-line consequence ("You'll see this again tomorrow"). Not-quite uses the coral dashed-circle motif, correct uses a gold check.
- All options remain visible: the correct one with gold border, check and "CORRECT"; the user's wrong choice with coral border, cross and "YOURS"; others dimmed.
- **Why** card: 1 to 3 sentences, source line in small muted text.
- Actions: Go deeper, Related (text buttons), Note, a flag button (44 px circle outline) and a gold **Continue** button.

### 4.4 Library (topic picker)
- Search field; filter chips (All, Started, New, Due).
- Shelves: **Continue**, then one shelf per domain (for example Science, Ideas, History and Work), cards with title, progress bar, counts. Calm, scannable, not Amazon-dense: at most three shelves visible before scrolling, at most about 2.5 cards visible per row to hint at scrolling.
- Tapping a card opens the subject page.

### 4.5 Subject page (drill-down)
- Back button labelled with the parent ("Library"), subject title (Fraunces), stats line ("148 questions · 5 branches · 41% mastered"), a gold **Practice <Subject>** button.
- Branch list as rows with thin progress bars and counts; expanding a branch reveals its topics inline with an indented gold guide line. New branches show "New" and a count.
- Tree depth: domain > subject > branch > topic; deeper nesting is not shown in the UI.

### 4.6 Stats
- Overall retention (large number), streak, topics ranked with bars (weakest in coral, sorted to show unevenness), weak-spot list with "Drill these", 5-week heatmap (gold intensity).
- A quiet row "Rewards" leads to the rewards screen (one tap deep).

### 4.7 Rewards
- Level ring with title (for example "Level 7 · Stargazer") and XP to next level.
- Weekly challenge with progress ("9/15 · +150 XP").
- Subject titles, badge grid (about 8, earned lit, unearned dim). Restrained: no confetti walls, no pushy copy.

### 4.8 Onboarding (later milestone)
Welcome, pick interests (tree chips), pick pace (three presets), install instructions on iOS, optional placement quiz. No account step.

### 4.9 Constellation map (later milestone)
Full-screen pan and zoom map: subjects as constellations, topics as stars, lines for prerequisites, brightness for retention. Tapping a star opens the topic.

### 4.10 Settings
Daily goal, new items per day, desired retention, tier mix and unlock, confidence prompts on/off, gamification on/off, reduced motion override, export/import, about.

## 5. Components to build once and reuse
Button (primary, secondary, text), OptionButton (default, selected, correct, wrong, dimmed), ProgressBar, ProgressRing, Chip, Card, ShelfRow, TreeRow (collapsed/expanded), StatBar, Heatmap, StarField (SVG), TopBar, TabBar, Sidebar, Sheet. Each has a story or test page for visual review at phone and iPad-landscape sizes.

## 6. Copy tone
Short, warm, plain. "Not quite", "You'll see this again tomorrow", "Done for today". Never scolding, never exclamation-heavy.

## 7. Open design items
- App icon and wordmark (a single bright star among dim ones is the working idea).
- Exact constellation art style for the Today hero (abstract versus stylized named constellation).
- Final map visual design.
