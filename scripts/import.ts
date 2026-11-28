/**
 * `npm run import -- --file <x.csv|x.txt> --pack <new-id> --title "..."
 *   --license "..." --origin "..." [--domain id:Label]` (SPEC 16.6).
 * Creates a new pack of draft questions from a CSV (see content/IMPORT.md)
 * or an Anki "Notes in plain text" export, records origin and license, and
 * registers the new IDs. Never overwrites an existing pack.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/content.ts';
import {
  ankiRows,
  buildImportPack,
  csvRows,
  parseAnki,
  parseCsv,
  slug,
} from '../src/core/content/import.ts';

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    pack: { type: 'string' },
    title: { type: 'string' },
    license: { type: 'string' },
    origin: { type: 'string' },
    domain: { type: 'string' },
  },
});
const { file, pack, title, license, origin } = values;
if (!file || !pack || !title || !license || !origin) {
  console.error(
    'Usage: npm run import -- --file x.csv --pack my-pack --title "Title" --license "CC-BY-4.0" --origin "Where it came from" [--domain id:Label]',
  );
  process.exit(2);
}
if (slug(pack) !== pack) {
  console.error(`import: pack ID must be lowercase kebab-case, e.g. "${slug(pack)}".`);
  process.exit(2);
}
const dir = join(ROOT, 'content', 'packs', pack);
if (existsSync(dir)) {
  console.error(`import: content/packs/${pack} already exists; choose a new pack ID.`);
  process.exit(1);
}

const text = readFileSync(file, 'utf8');
const anki = !file.toLowerCase().endsWith('.csv');
const { rows, errors } = anki ? ankiRows(parseAnki(text), origin) : csvRows(parseCsv(text), origin);
for (const e of errors) console.error(`  skipped ${e}`);
if (rows.length === 0) {
  console.error('import: no valid rows; nothing written.');
  process.exit(1);
}

const [domainId = 'imported', domainLabel = 'Imported'] = (values.domain ?? '').split(':');
const built = buildImportPack(rows, {
  packId: pack,
  title,
  license,
  origin,
  domain: { id: domainId || 'imported', label: domainLabel || domainId },
  // Script, not core: the import date comes from the system clock.
  date: new Date().toISOString().slice(0, 10),
});

const schema = (name: string, depth: number) => `${'../'.repeat(depth)}schema/${name}.schema.json`;
mkdirSync(join(dir, 'questions'), { recursive: true });
const write = (path: string, value: object) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
write(join(dir, 'pack.json'), { $schema: schema('pack', 3), ...built.meta });
write(join(dir, 'taxonomy.json'), { $schema: schema('taxonomy', 3), nodes: built.taxonomy });
for (const [topic, questions] of built.files) {
  write(join(dir, 'questions', `${topic}.json`), {
    $schema: schema('questions-file', 4),
    questions,
  });
}
execFileSync('npx', ['prettier', '--write', dir], { stdio: 'ignore' });
console.log(
  `import: wrote ${rows.length} draft(s) to content/packs/${pack} (${errors.length} skipped).`,
);
execFileSync('node', ['scripts/register-ids.ts'], { stdio: 'inherit', cwd: ROOT });
execFileSync('node', ['scripts/validate-content.ts'], { stdio: 'inherit', cwd: ROOT });
