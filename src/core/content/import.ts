import { TIERS, type PackMeta, type Question, type TaxonomyNode, type Tier } from './types.ts';

/** One CSV record (RFC 4180): fields may be quoted, with "" for a quote and newlines inside. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** Anki "Notes in plain text": front<TAB>back per line; # header lines skipped; HTML stripped. */
export function parseAnki(text: string): { front: string; back: string; line: number }[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .flatMap((raw, i) => {
      if (raw.startsWith('#') || raw.trim() === '') return [];
      const [front = '', back = ''] = raw.split('\t');
      return [{ front: stripHtml(front), back: stripHtml(back), line: i + 1 }];
    });
}

export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export const slug = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const CSV_COLUMNS = [
  'type',
  'topic',
  'tier',
  'prompt',
  'answer',
  'options',
  'explanation',
  'source',
  'tags',
] as const;

/** One parsed row, before IDs are assigned. */
export interface ImportRow {
  readonly line: number;
  readonly type: 'mcq' | 'recall' | 'short';
  readonly topic: string;
  readonly tier: Tier;
  readonly prompt: string;
  readonly answer: string;
  readonly options: readonly string[];
  readonly explanation: string;
  readonly source: string;
  readonly tags: readonly string[];
}

const list = (s: string | undefined): string[] =>
  (s ?? '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);

/** CSV rows to import rows; bad rows are reported by line and left out. */
export function csvRows(
  table: readonly (readonly string[])[],
  origin: string,
): { rows: ImportRow[]; errors: string[] } {
  const [header = [], ...body] = table;
  const cols = header.map((h) => h.trim().toLowerCase());
  const missing = ['type', 'prompt', 'answer'].filter((c) => !cols.includes(c));
  if (missing.length > 0) return { rows: [], errors: [`Header lacks: ${missing.join(', ')}.`] };
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (c: string) => (cells[cols.indexOf(c)] ?? '').trim();
    const type = get('type').toLowerCase() || 'recall';
    const tier = (get('tier').toLowerCase() || 'foundational') as Tier;
    const prompt = get('prompt');
    const answer = get('answer');
    const options = list(get('options'));
    const problem = !['mcq', 'recall', 'short'].includes(type)
      ? `type "${type}" (use mcq, recall or short)`
      : !TIERS.includes(tier)
        ? `tier "${tier}"`
        : !prompt
          ? 'empty prompt'
          : !answer
            ? 'empty answer'
            : type === 'mcq' && (options.length < 3 || options.length > 4)
              ? 'MCQ needs 3 or 4 distractors in options'
              : null;
    if (problem) {
      errors.push(`Line ${line}: ${problem}.`);
      return;
    }
    rows.push({
      line,
      type: type as ImportRow['type'],
      topic: get('topic') || 'Imported',
      tier,
      prompt,
      answer,
      options,
      explanation: get('explanation') || answer,
      source: get('source') || origin,
      tags: list(get('tags')).map(slug).filter(Boolean),
    });
  });
  return { rows, errors };
}

/** Anki notes to import rows (recall). */
export function ankiRows(
  notes: readonly { front: string; back: string; line: number }[],
  origin: string,
): { rows: ImportRow[]; errors: string[] } {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  for (const n of notes) {
    if (!n.front || !n.back) {
      errors.push(`Line ${n.line}: needs a front and a back.`);
      continue;
    }
    rows.push({
      line: n.line,
      type: 'recall',
      topic: 'Imported',
      tier: 'foundational',
      prompt: n.front,
      answer: n.back,
      options: [],
      explanation: n.back,
      source: origin,
      tags: ['imported'],
    });
  }
  return { rows, errors };
}

export interface ImportOptions {
  readonly packId: string;
  readonly title: string;
  readonly license: string;
  readonly origin: string;
  /** Domain node to attach under: an existing ID, or a new one with this label. */
  readonly domain: { readonly id: string; readonly label: string };
  /** ISO date (YYYY-MM-DD) of the import. */
  readonly date: string;
  readonly accent?: string;
}

export interface ImportedPack {
  readonly meta: PackMeta;
  readonly taxonomy: TaxonomyNode[];
  /** Questions per topic ID (one file each). */
  readonly files: ReadonlyMap<string, Question[]>;
}

/** Build a new draft pack from import rows (SPEC 16.6). */
export function buildImportPack(rows: readonly ImportRow[], o: ImportOptions): ImportedPack {
  const topics = new Map<string, string>(); // label -> node id
  for (const r of rows)
    if (!topics.has(r.topic)) topics.set(r.topic, `${o.packId}-${slug(r.topic) || 'topic'}`);
  const taxonomy: TaxonomyNode[] = [
    { id: o.domain.id, label: o.domain.label, kind: 'domain' },
    { id: o.packId, label: o.title, kind: 'subject', parent: o.domain.id },
    ...[...topics].map(([label, id], i) => ({
      id,
      label,
      kind: 'topic' as const,
      parent: o.packId,
      order: i + 1,
    })),
  ];
  const files = new Map<string, Question[]>();
  rows.forEach((r, i) => {
    const topic = topics.get(r.topic) ?? '';
    const base = {
      id: `${o.packId}-imp-${String(i + 1).padStart(4, '0')}`,
      pack: o.packId,
      topic,
      tier: r.tier,
      tags: r.tags.length > 0 ? r.tags : ['imported'],
      prompt: r.prompt,
      explanation: r.explanation,
      sources: [{ citation: r.source }],
      status: 'draft' as const,
      created: o.date,
    };
    const q: Question =
      r.type === 'mcq'
        ? {
            ...base,
            type: 'mcq',
            options: [{ text: r.answer }, ...r.options.map((text) => ({ text }))],
            answer: 0,
          }
        : r.type === 'short'
          ? { ...base, type: 'short', answers: list(r.answer) }
          : { ...base, type: 'recall', answer_text: r.answer };
    files.set(topic, [...(files.get(topic) ?? []), q]);
  });
  return {
    meta: {
      id: o.packId,
      title: o.title,
      description: `Imported from ${o.origin}.`,
      version: '0.1.0',
      language: 'en',
      author: 'Imported',
      license: o.license,
      provenance: `Imported from ${o.origin} on ${o.date}. All items are drafts until verified.`,
      created: o.date,
      domainPath: [o.domain.id, o.packId],
      accent: o.accent ?? 'gold',
    },
    taxonomy,
    files,
  };
}
