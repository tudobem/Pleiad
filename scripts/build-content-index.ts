/**
 * `npm run content:index`: writes public/content/content-index.json (SPEC 5.3)
 * and public/content/packs/<pack-id>.<hash>.json with each pack's verified
 * questions (the only ones that enter reviews). The content hash in the name
 * lets the service worker cache packs forever: a new version is a new file.
 * Refuses to write if the content has errors.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatIssues, loadContent, ROOT } from './lib/content.ts';
import { validateContent } from '../src/core/content/validate.ts';
import { buildContentIndex } from '../src/core/content/contentIndex.ts';
import type { PackContent } from '../src/core/content/source.ts';
import { servedPack } from '../src/core/content/servedPack.ts';

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

const packFiles: Record<string, string> = {};
const draftFiles: Record<string, { file: string; count: number }> = {};
const packJson = new Map<string, string>();
let verified = 0;
const thinkers = new Map(loaded.packs.flatMap((p) => p.thinkers ?? []).map((t) => [t.id, t]));
for (const pack of loaded.packs) {
  // Images are inlined so they are cached and offline with the pack (M13b).
  const content: PackContent = servedPack(pack, thinkers, (src) =>
    readFileSync(join(ROOT, 'content', 'packs', pack.folder, src)).toString('base64'),
  );
  verified += content.questions.length;
  // Drafts for in-app review: fetched only by the review screen, never cached (M14).
  const drafts = servedPack(
    pack,
    thinkers,
    (src) => readFileSync(join(ROOT, 'content', 'packs', pack.folder, src)).toString('base64'),
    'draft',
  );
  if (drafts.questions.length > 0) {
    const draftJson = `${JSON.stringify(drafts)}\n`;
    const draftHash = createHash('sha256').update(draftJson).digest('hex').slice(0, 10);
    const draftFile = `packs/${pack.meta.id}.drafts.${draftHash}.json`;
    draftFiles[pack.meta.id] = { file: draftFile, count: drafts.questions.length };
    packJson.set(draftFile, draftJson);
  }
  const json = `${JSON.stringify(content)}\n`;
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 10);
  const file = `packs/${pack.meta.id}.${hash}.json`;
  packFiles[pack.meta.id] = file;
  packJson.set(file, json);
}

const index = buildContentIndex(loaded.packs, result.taxonomy, packFiles, draftFiles);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'packs'), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`);
for (const [file, json] of packJson) writeFileSync(join(outDir, file), json);
console.log(
  `content:index: wrote the index and ${index.packs.length} pack file(s) with ${verified} verified question(s) to public/content/`,
);
