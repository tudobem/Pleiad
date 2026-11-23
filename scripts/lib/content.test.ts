import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentPaths, loadContent, readTokenNames, ROOT } from './content.ts';
import { validateContent } from '../../src/core/content/validate.ts';
import { buildContentIndex } from '../../src/core/content/contentIndex.ts';

function validateAll(paths = contentPaths()) {
  const loaded = loadContent(paths);
  const semantic =
    loaded.issues.length === 0
      ? validateContent({
          packs: loaded.packs,
          ...(loaded.ledger ? { ledger: loaded.ledger } : {}),
          accentTokens: loaded.accentTokens,
        })
      : undefined;
  return { loaded, semantic, issues: [...loaded.issues, ...(semantic?.issues ?? [])] };
}

describe('real content', () => {
  it('passes all schema and semantic checks', () => {
    const { loaded, issues } = validateAll();
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(loaded.packs.length).toBeGreaterThanOrEqual(2);
  });

  it('requires verified_on on every verified question', () => {
    const { loaded } = validateAll();
    const questions = loaded.packs.flatMap((p) => p.questionFiles.flatMap((f) => f.questions));
    const verified = questions.filter((q) => q.status === 'verified');
    for (const q of verified) expect(q.verified_on).toBeDefined();
  });

  it('produces a byte-identical index on repeated builds', () => {
    const one = validateAll();
    const two = validateAll();
    if (!one.semantic || !two.semantic) throw new Error('content invalid');
    const a = JSON.stringify(buildContentIndex(one.loaded.packs, one.semantic.taxonomy));
    const b = JSON.stringify(buildContentIndex(two.loaded.packs, two.semantic.taxonomy));
    expect(a).toBe(b);
  });

  it('reads color token names from tokens.css', () => {
    const tokens = readTokenNames(contentPaths().tokensFile);
    expect(tokens.has('gold')).toBe(true);
    expect(tokens.has('link')).toBe(true);
  });
});

describe('schema checks on a copy of the content', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function copy() {
    dir = mkdtempSync(join(tmpdir(), 'pleiad-content-'));
    for (const sub of ['content', 'schema', 'src/ui/tokens.css']) {
      cpSync(join(ROOT, sub), join(dir, sub), { recursive: true });
    }
    return contentPaths(dir);
  }

  function editQuestionFile(
    paths: ReturnType<typeof contentPaths>,
    edit: (qs: Record<string, unknown>[]) => void,
  ) {
    const file = join(paths.packsDir, 'consciousness-science', 'questions', 'iit.json');
    const data = JSON.parse(readFileSync(file, 'utf8')) as { questions: Record<string, unknown>[] };
    edit(data.questions);
    writeFileSync(file, JSON.stringify(data));
  }

  const schemaErrors = (paths: ReturnType<typeof contentPaths>) =>
    loadContent(paths).issues.filter((i) => i.code === 'schema');

  it('rejects a question without sources', () => {
    const paths = copy();
    editQuestionFile(paths, (qs) => {
      if (qs[0]) qs[0].sources = [];
    });
    expect(schemaErrors(paths).length).toBeGreaterThan(0);
  });

  it('rejects mcq fields on a recall item and vice versa', () => {
    const paths = copy();
    editQuestionFile(paths, (qs) => {
      const recall = qs.find((q) => q.type === 'recall');
      if (recall) recall.answer = 0;
    });
    expect(schemaErrors(paths).length).toBeGreaterThan(0);
  });

  it('rejects an MCQ with three options', () => {
    const paths = copy();
    editQuestionFile(paths, (qs) => {
      const q = qs.find((x) => x.type === 'mcq');
      if (q && Array.isArray(q.options)) q.options = q.options.slice(0, 3);
    });
    expect(schemaErrors(paths).length).toBeGreaterThan(0);
  });

  it('rejects unknown fields, bad tiers and bad dates', () => {
    const paths = copy();
    editQuestionFile(paths, (qs) => {
      if (qs[0]) {
        qs[0].difficulty = 3;
        qs[0].tier = 'beginner';
        qs[0].created = '2026-13-01';
      }
    });
    expect(schemaErrors(paths).length).toBeGreaterThanOrEqual(3);
  });

  it('detects a deleted question through the ledger', () => {
    const paths = copy();
    editQuestionFile(paths, (qs) => {
      qs.pop();
    });
    const codes = validateAll(paths).issues.map((i) => i.code);
    expect(codes).toContain('ledger.deleted');
  });

  it('reports invalid JSON and a missing ledger', () => {
    const paths = copy();
    writeFileSync(join(paths.packsDir, 'philosophy-of-mind', 'taxonomy.json'), '{ nope');
    rmSync(paths.ledgerFile);
    const codes = loadContent(paths).issues.map((i) => i.code);
    expect(codes).toContain('file.json');
    expect(codes).toContain('file.missing');
  });
});
