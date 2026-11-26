# Content packs

A pack is the unit of content (SPEC 5.2). Adding a subject means adding a pack folder here: no code change.

```
content/packs/<pack-id>/
  pack.json              metadata: title, version, license, provenance, domainPath, accent
  taxonomy.json          taxonomy nodes this pack adds or shares
  questions/<topic>.json questions for one topic
  concepts.json          optional concept graph
  media/                 optional images (self-authored or licensed)
content/ids.json         ledger of every question ID ever registered
schema/*.schema.json     JSON Schemas for all of the above
```

Each file starts with a `$schema` entry, so editors such as VS Code autocomplete fields and flag mistakes.

## Taxonomy

Four levels: `domain > subject > branch > topic`. A topic may also sit directly under a subject. Questions attach to topics only. Node IDs are global: two packs can both declare a shared node (for example the `philosophy` domain) as long as the declarations are identical.

Siblings are listed alphabetically by label (ignoring case) unless they have an optional integer `order` (ascending), which puts them first, in that order. Use it where alphabetical is wrong, such as chronological history topics or the order of a book's chapters. Nodes without `order` follow the ordered ones. Two siblings with the same `order` produce a validator warning. A node declared by several packs must carry the same `order` in each.

`pack.json` `domainPath` lists node IDs from the root down to where the pack attaches, for example `["philosophy", "philosophy-of-mind"]`. `accent` names a color token in `src/ui/tokens.css` (for example `gold`).

## Questions

- `id`: lowercase kebab-case, globally unique, never reused, for example `cons-iit-0004`. Convention: short pack prefix, topic abbreviation, four-digit number.
- `topic` must equal the file name, and `pack` the folder.
- Every question needs at least one source, a tier (`foundational`, `advanced`, `expert`), tags, a prompt, a 1 to 3 sentence explanation, and `status: draft`.
- `mcq`: 4 or 5 `options` (`{ text, why_wrong? }`) and `answer`, the index of the one correct option. Options are shuffled when shown. No "all/none of the above". `why_wrong` explains a distractor.
- `recall`: `answer_text`, a short model answer.
- Contested topics use attributed phrasing ("According to IIT...", "Chalmers argues...").
- Paraphrase and cite; never copy passages. The repository is public.

## Workflow

1. Add or edit questions with `status: "draft"`.
2. New IDs: `npm run content:register` (adds them to `content/ids.json`).
3. `npm run format`, then `npm run validate:content` must report 0 errors.
4. Martin reviews drafts and names the IDs to verify. Only then is `status` set to `verified` with `verified_on`.
5. To remove a question, set `status: "retired"`. Never delete it or reuse its ID. If an answer changes materially, retire the item and create a new ID.

`npm run content:index` (also run before every build) writes `public/content/content-index.json`, the small index the app loads at startup.
