/**
 * `npm run content:index`: writes public/content/content-index.json (SPEC 5.3).
 * Refuses to write if the content has errors.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatIssues, loadContent, ROOT } from './lib/content.ts';
import { validateContent } from '../src/core/content/validate.ts';
import { buildContentIndex } from '../src/core/content/contentIndex.ts';

const outFile = join(ROOT, 'public', 'content', 'content-index.json');

const loaded = loadContent();
const result =
  loaded.issues.length === 0
    ? validateContent({
        packs: loaded.packs,
        ...(loaded.ledger ? { ledger: loaded.ledger } : {}),
        accentTokens: loaded.accentTokens,
      })
    : undefined;
const errors = [...loaded.issues, ...(result?.issues ?? [])].filter((i) => i.level === 'error');
if (!result || errors.length > 0) {
  console.error(
    `content:index: content has errors; run npm run validate:content.\n${formatIssues(errors)}`,
  );
  process.exit(1);
}

const index = buildContentIndex(loaded.packs, result.taxonomy);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`);
console.log(
  `content:index: wrote ${index.packs.length} pack(s) to public/content/content-index.json`,
);
