/**
 * `npm run apply-decisions -- <review-decisions.json>` (SPEC 16.4 path B):
 * applies Martin's in-app review decisions to the question files.
 * Approve -> verified (verified_on = decision date); Reject -> retired;
 * Needs edit -> unchanged, listed with its note. Only drafts change.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentPaths, formatIssues, loadContent, ROOT } from './lib/content.ts';
import { applyDecisions, parseDecisions } from '../src/core/review/decisions.ts';
import type { Question } from '../src/core/content/types.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run apply-decisions -- <review-decisions.json>');
  process.exit(2);
}

let decisions;
try {
  decisions = parseDecisions(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`apply-decisions: ${(e as Error).message}`);
  process.exit(1);
}

const paths = contentPaths();
const loaded = loadContent(paths);
if (loaded.issues.some((i) => i.level === 'error')) {
  console.error(`apply-decisions: fix content errors first.\n${formatIssues(loaded.issues)}`);
  process.exit(1);
}
const all = new Map<string, Question>();
for (const pack of loaded.packs) {
  for (const qf of pack.questionFiles) for (const q of qf.questions) all.set(q.id, q);
}

const result = applyDecisions(all, decisions);
const written: string[] = [];
for (const pack of loaded.packs) {
  for (const qf of pack.questionFiles) {
    if (!qf.questions.some((q) => result.changed.has(q.id))) continue;
    const abs = join(ROOT, 'content', 'packs', qf.path);
    const json = JSON.parse(readFileSync(abs, 'utf8')) as { questions: Question[] };
    json.questions = json.questions.map((q) => result.changed.get(q.id) ?? q);
    writeFileSync(abs, `${JSON.stringify(json, null, 2)}\n`);
    written.push(abs);
  }
}
if (written.length > 0)
  execFileSync('npx', ['prettier', '--write', ...written], { stdio: 'ignore' });

const line = (label: string, ids: readonly string[]) =>
  console.log(`${label} (${ids.length})${ids.length > 0 ? `: ${ids.join(', ')}` : ''}`);
line('Verified', result.verified);
line('Retired', result.retired);
console.log(`Needs edit (${result.needsEdit.length})`);
for (const e of result.needsEdit) console.log(`  ${e.id}: ${e.note}`);
if (result.skipped.length > 0) {
  console.log(`Skipped (${result.skipped.length})`);
  for (const s of result.skipped) console.log(`  ${s.id}: ${s.reason}`);
}
execFileSync('node', ['scripts/validate-content.ts'], { stdio: 'inherit', cwd: ROOT });
