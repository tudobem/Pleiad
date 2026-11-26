import { describe, expect, it } from 'vitest';
import { seededRandom } from '../random.ts';
import { buildSession, interleaveBy, layoutFor, sessionEligible } from './session.ts';
import { ratingFor } from './rating.ts';
import { cloze, match, mcq, order, recall, short } from '../content/fixtures.test-util.ts';
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
  it('keeps verified items of every supported type', () => {
    const v = { status: 'verified' as const, verified_on: '2026-02-01' };
    const items = [mcq(), verified(mcq({ id: 'v' })), recall(v), short(v), cloze()];
    expect(sessionEligible(items).map((q) => q.id)).toEqual(['v', 'q-recall-0001', 'q-short-0001']);
  });
});

describe('buildSession', () => {
  it('picks up to size distinct items with permuted options', () => {
    const items = buildSession(pool, { size: 10, random: seededRandom(7) });
    expect(items).toHaveLength(10);
    expect(new Set(items.map((i) => i.questionId)).size).toBe(10);
    for (const item of items) expect([...item.layout].sort()).toEqual([0, 1, 2, 3]);
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

describe('layoutFor', () => {
  it('shuffles what each type displays', () => {
    const r = seededRandom(5);
    expect([...layoutFor(mcq(), r)].sort()).toEqual([0, 1, 2, 3]);
    expect([...layoutFor(cloze(), r)].sort()).toEqual([0, 1, 2, 3]);
    expect([...layoutFor(match(), r)].sort()).toEqual([0, 1, 2]);
    expect(layoutFor(recall(), r)).toEqual([]);
    expect(layoutFor(short(), r)).toEqual([]);
  });

  it('never shows an order question already solved', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      expect(layoutFor(order(), seededRandom(seed))).not.toEqual([0, 1, 2]);
    }
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
