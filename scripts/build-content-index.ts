/**
 * `npm run content:index`: writes public/content/content-index.json (SPEC 5.3)
 * and public/content/packs/<pack-id>.json with each pack's verified questions
 * (the only ones that enter reviews). Refuses to write if the content has errors.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatIssues, loadContent, ROOT } from './lib/content.ts';
import { validateContent } from '../src/core/content/validate.ts';
import { buildContentIndex } from '../src/core/content/contentIndex.ts';
import type { PackContent } from '../src/core/content/source.ts';

const outDir = join(ROOT, 'public', 'content');
const outFile = join(outDir, 'content-index.json');

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
rmSync(outDir, { recursive: true, force: true });
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`);

const packsDir = join(outDir, 'packs');
mkdirSync(packsDir, { recursive: true });
let verified = 0;
for (const pack of loaded.packs) {
  const questions = pack.questionFiles
    .flatMap((f) => f.questions)
    .filter((q) => q.status === 'verified');
  verified += questions.length;
  const content: PackContent = { meta: pack.meta, questions };
  writeFileSync(join(packsDir, `${pack.meta.id}.json`), `${JSON.stringify(content)}\n`);
}
console.log(
  `content:index: wrote the index and ${index.packs.length} pack file(s) with ${verified} verified question(s) to public/content/`,
);
