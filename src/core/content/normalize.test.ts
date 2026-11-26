import { describe, expect, it } from 'vitest';
import {
  compareLabels,
  compareStrings,
  isCatchAllOption,
  jaccard,
  normalizeText,
} from './normalize.ts';

describe('normalize', () => {
  it('folds case, diacritics, punctuation and LaTeX', () => {
    expect(normalizeText('  Nida-Rümelin, $\\Phi$!  ')).toBe('nida rumelin');
  });

  it('measures token overlap', () => {
    expect(jaccard('a b c', 'a b c')).toBe(1);
    expect(jaccard('a b', 'c d')).toBe(0);
    expect(jaccard('a b c d', 'a b c e')).toBeCloseTo(0.6);
  });

  it('detects catch-all options only when the whole option is one', () => {
    expect(isCatchAllOption('All of the above')).toBe(true);
    expect(isCatchAllOption('Neither of these')).toBe(true);
    expect(isCatchAllOption('All of the above theories are wrong about phi')).toBe(false);
  });

  it('compares strings by code point', () => {
    expect(['b', 'B', 'a'].sort(compareStrings)).toEqual(['B', 'a', 'b']);
  });
});

describe('compareLabels', () => {
  it('ignores case first and falls back to code points for a stable order', () => {
    expect(['meta-d', 'Zebra', 'apple', 'Banana', 'Apple'].sort(compareLabels)).toEqual([
      'Apple',
      'apple',
      'Banana',
      'meta-d',
      'Zebra',
    ]);
  });
});
