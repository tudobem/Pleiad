/**
 * `npm run content:register`: adds new question IDs to content/ids.json.
 * Never removes an ID: retired questions stay in the content and the ledger.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { contentPaths, formatIssues, loadContent } from './lib/content.ts';
import { compareStrings } from '../src/core/content/normalize.ts';

const paths = contentPaths();
const loaded = loadContent(paths);
const blocking = loaded.issues.filter((i) => i.code !== 'file.missing' || i.file !== 'ids.json');
if (blocking.length > 0) {
  console.error(`content:register: fix these first.\n${formatIssues(blocking)}`);
  process.exit(1);
}

const existing: Record<string, string> = existsSync(paths.ledgerFile)
  ? (JSON.parse(readFileSync(paths.ledgerFile, 'utf8')) as { ids: Record<string, string> }).ids
  : {};
const ids: Record<string, string> = { ...existing };
const added: string[] = [];
for (const pack of loaded.packs) {
  for (const qf of pack.questionFiles) {
    for (const q of qf.questions) {
      if (!(q.id in ids)) {
        ids[q.id] = pack.meta.id;
        added.push(q.id);
      }
    }
  }
}

const sorted = Object.fromEntries(Object.entries(ids).sort(([a], [b]) => compareStrings(a, b)));
writeFileSync(
  paths.ledgerFile,
  `${JSON.stringify({ $schema: '../schema/id-ledger.schema.json', ids: sorted }, null, 2)}\n`,
);
console.log(
  `content:register: ${added.length} new ID(s) registered; ledger has ${Object.keys(sorted).length}.`,
);
