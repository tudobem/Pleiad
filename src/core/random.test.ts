import { describe, expect, it } from 'vitest';
import { seededRandom, shuffle } from './random.ts';

describe('random', () => {
  it('is reproducible for a seed and stays in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = Array.from({ length: 100 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b.next()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('shuffles into a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seededRandom(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});
