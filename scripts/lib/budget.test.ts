import { describe, expect, it } from 'vitest';
import { entryScripts, initialChunks, staticImports } from './budget.ts';

describe('budget helpers', () => {
  it('finds static imports and re-exports but not dynamic imports', () => {
    const code =
      'import{a as b}from"./vendor-1.js";import"./side.js";export*from"./more.js";const k=()=>import("./katex-2.js");';
    expect(staticImports(code).sort()).toEqual(['./more.js', './side.js', './vendor-1.js']);
  });

  it('reads entry scripts and modulepreloads from index.html', () => {
    const html =
      '<script type="module" crossorigin src="/p/assets/index-1.js"></script><link rel="modulepreload" crossorigin href="/p/assets/vendor-1.js">';
    expect(entryScripts(html)).toEqual(['/p/assets/index-1.js', '/p/assets/vendor-1.js']);
  });

  it('walks the static import graph once per chunk', () => {
    const files: Record<string, string> = {
      'index.js': 'import"./a.js";import"./b.js";import("./lazy.js")',
      'a.js': 'import"./b.js"',
      'b.js': 'export const x=1',
      'lazy.js': 'import"./never.js"',
    };
    expect(initialChunks(['index.js'], (f) => files[f] ?? '').sort()).toEqual([
      'a.js',
      'b.js',
      'index.js',
    ]);
  });
});
