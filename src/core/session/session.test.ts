import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random.ts';
import { buildSession, gradeMcq, interleaveBy, sessionEligible } from './session.ts';
import { ratingFor } from './rating.ts';
import { mcq, recall } from '../content/fixtures.test-util.ts';
import type { McqQuestion } from '../content/types.ts';

const verified = (q: McqQuestion) => ({
  ...q,
  status: 'verified' as const,
  verified_on: '2026-02-01',
});
const pool: McqQuestion[] = Array.from({ length: 12 }, (_, i) =>
  verified(mcq({ id: `q-${i}`, pack: i % 3 === 0 ? 'b' : 'a' })),
);

describe('sessionEligible', () => {
  it('keeps verified MCQs only', () => {
    const items = [
      mcq(),
      verified(mcq({ id: 'v' })),
      recall({ status: 'verified', verified_on: '2026-02-01' }),
    ];
    expect(sessionEligible(items).map((q) => q.id)).toEqual(['v']);
  });
});

describe('buildSession', () => {
  it('picks up to size distinct items with permuted options', () => {
    const items = buildSession(pool, { size: 10, random: seededRandom(7) });
    expect(items).toHaveLength(10);
    expect(new Set(items.map((i) => i.questionId)).size).toBe(10);
    for (const item of items) expect([...item.displayOrder].sort()).toEqual([0, 1, 2, 3]);
  });

  it('is deterministic for a seed and handles small pools', () => {
    const a = buildSession(pool, { size: 5, random: seededRandom(3) });
    const b = buildSession(pool, { size: 5, random: seededRandom(3) });
    expect(a).toEqual(b);
    expect(buildSession(pool.slice(0, 2), { size: 10, random: seededRandom(3) })).toHaveLength(2);
    expect(buildSession([], { size: 10, random: seededRandom(3) })).toEqual([]);
  });
});

describe('interleaveBy', () => {
  it('alternates groups while keeping order within a group', () => {
    const out = interleaveBy(['a1', 'a2', 'a3', 'b1', 'b2'], (s) => s[0] ?? '');
    expect(out).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
  });
});

describe('gradeMcq', () => {
  it('maps the display position back to the original option', () => {
    const q = verified(mcq({ answer: 2 }));
    const item = { questionId: q.id, displayOrder: [3, 2, 0, 1] };
    expect(gradeMcq(q, item, 1)).toEqual({ correct: true, chosenOption: 2 });
    expect(gradeMcq(q, item, 0)).toEqual({ correct: false, chosenOption: 3 });
    expect(() => gradeMcq(q, item, 4)).toThrow(RangeError);
  });
});

describe('ratingFor (SPEC 7.3)', () => {
  it.each([
    [{ correct: false }, 'again'],
    [{ correct: false, tooEasy: true }, 'again'],
    [{ correct: true }, 'good'],
    [{ correct: true, guess: true }, 'hard'],
    [{ correct: true, slow: true }, 'hard'],
    [{ correct: true, tooEasy: true }, 'easy'],
  ] as const)('%o -> %s', (input, rating) => {
    expect(ratingFor(input)).toBe(rating);
  });
});
