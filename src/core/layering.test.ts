import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// Lints snippets as if they lived in src/core and checks the layering rules
// from eslint.config.js fire (SPEC 3.2, 20).
const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function ruleIdsFor(code: string, file = 'src/core/__fixture__.ts'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error');
}

describe('core layering rules', () => {
  it.each([
    ["import { x } from '../platform/clock/systemClock.ts';\nexport { x };", 'platform'],
    ["import { x } from '../../ui/strings.ts';\nexport { x };", 'ui'],
    ["import { x } from '../app/main.tsx';\nexport { x };", 'app'],
    ["import { h } from 'preact';\nexport { h };", 'preact'],
    ["import { openDB } from 'idb';\nexport { openDB };", 'idb'],
    ["import { readFileSync } from 'node:fs';\nexport { readFileSync };", 'node'],
  ])('rejects forbidden import (%#: %s)', async (code) => {
    expect(await ruleIdsFor(code)).toContain('no-restricted-imports');
  });

  it.each(['window', 'document', 'localStorage', 'indexedDB', 'navigator', 'fetch'])(
    'rejects browser global %s',
    async (name) => {
      expect(await ruleIdsFor(`export const x = ${name};`)).toContain('no-restricted-globals');
    },
  );

  it('rejects Math.random()', async () => {
    expect(await ruleIdsFor('export const r = Math.random();')).toContain('no-restricted-syntax');
  });

  it('rejects Date.now() and argument-less new Date()', async () => {
    expect(await ruleIdsFor('export const t = Date.now();')).toContain('no-restricted-syntax');
    expect(await ruleIdsFor('export const d = new Date();')).toContain('no-restricted-syntax');
  });

  it('allows pure code, sibling core imports and new Date(ms)', async () => {
    const code =
      "import type { Clock } from './clock.ts';\nexport const f = (c: Clock) => new Date(c.now());";
    expect(await ruleIdsFor(code)).toEqual([]);
  });

  it('does not apply core rules outside core', async () => {
    expect(await ruleIdsFor('export const t = Date.now();', 'src/platform/__fixture__.ts')).toEqual(
      [],
    );
  });
});

describe('platform layering rules', () => {
  it('rejects imports from ui', async () => {
    const code = "import { x } from '../../ui/strings.ts';\nexport { x };";
    expect(await ruleIdsFor(code, 'src/platform/storage/__fixture__.ts')).toContain(
      'no-restricted-imports',
    );
  });
});

describe('ui layering rules', () => {
  it('rejects imports from platform', async () => {
    const code = "import { uuidIds } from '../platform/ids.ts';\nexport { uuidIds };";
    expect(await ruleIdsFor(code, 'src/ui/__fixture__.ts')).toContain('no-restricted-imports');
  });

  it('allows imports from core', async () => {
    const code = "import type { Clock } from '../core/clock.ts';\nexport type C = Clock;";
    expect(await ruleIdsFor(code, 'src/ui/__fixture__.ts')).toEqual([]);
  });
});
