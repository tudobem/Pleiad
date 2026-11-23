import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Colors live only in tokens.css (CLAUDE.md conventions).
const uiDir = fileURLToPath(new URL('.', import.meta.url));
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(css|tsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('design tokens', () => {
  it('only tokens.css contains raw color values', () => {
    const offenders = sourceFiles(uiDir)
      .filter((file) => !file.endsWith('tokens.css'))
      .filter((file) => COLOR_LITERAL.test(readFileSync(file, 'utf8')))
      .map((file) => relative(uiDir, file));
    expect(offenders).toEqual([]);
  });

  it('defines every color token from DESIGN.md', () => {
    const css = readFileSync(join(uiDir, 'tokens.css'), 'utf8');
    const required = [
      'bg',
      'bg-glow-a',
      'bg-glow-b',
      'text',
      'text-muted',
      'text-dim',
      'gold',
      'gold-text',
      'on-gold',
      'coral',
      'coral-text',
      'track',
      'link',
      'surface',
      'border',
      'gold-tint',
      'coral-tint',
    ];
    const missing = required.filter((name) => !new RegExp(`--${name}\\s*:`).test(css));
    expect(missing).toEqual([]);
  });
});
