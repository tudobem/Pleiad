/**
 * `npm run budget`: startup budget check on the production build (SPEC 18:
 * first meaningful screen under 1 s from cache on a recent iPhone). Real
 * timing is measured by `npm run e2e` (local); CI guards the sizes that
 * drive it:
 *  - initial JS (entry chunk plus its static imports), gzipped: <= 100 KB;
 *  - precached app shell, excluding KaTeX (fonts and the lazy chunk, only
 *    loaded with maths): <= 1 MB.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { entryScripts, gzipSize, initialChunks } from './lib/budget.ts';
import { ROOT } from './lib/content.ts';

const INITIAL_JS_GZIP_LIMIT = 100 * 1024;
const SHELL_LIMIT = 1024 * 1024;

const dist = join(ROOT, 'dist');
const assets = join(dist, 'assets');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entries = entryScripts(html).map((src) => basename(src));
if (entries.length === 0) {
  console.error('budget: no entry script found in dist/index.html; run npm run build first.');
  process.exit(1);
}
const chunks = initialChunks(entries, (file) => readFileSync(join(assets, file), 'utf8'));
const initialGzip = chunks.reduce((sum, f) => sum + gzipSize(readFileSync(join(assets, f))), 0);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
// Mirrors the precache globs in vite.config.ts (content packs are cached at runtime).
const precached = walk(dist).filter((path) => {
  const rel = relative(dist, path);
  if (rel.startsWith('content/')) return rel === 'content/content-index.json';
  if (/icon(-maskable)?-512\.png$/.test(rel)) return false;
  return /\.(js|css|html|svg|png|woff2|webmanifest)$/.test(rel);
});
const shell = precached
  .filter((path) => !/katex/i.test(basename(path)))
  .reduce((sum, path) => sum + statSync(path).size, 0);

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `budget: initial JS ${kb(initialGzip)} gzip in ${chunks.length} chunk(s) (limit ${kb(INITIAL_JS_GZIP_LIMIT)})`,
);
console.log(`budget: precached shell without KaTeX ${kb(shell)} (limit ${kb(SHELL_LIMIT)})`);
const failures = [
  initialGzip > INITIAL_JS_GZIP_LIMIT ? 'initial JS is over budget' : null,
  shell > SHELL_LIMIT ? 'precached shell is over budget' : null,
].filter(Boolean);
if (failures.length > 0) {
  console.error(`budget: ${failures.join('; ')}`);
  process.exit(1);
}
