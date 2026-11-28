import { describe, expect, it } from 'vitest';
import { mcq, recall } from '../content/fixtures.test-util.ts';
import type { McqQuestion, Tier } from '../content/types.ts';
import { seededRandom } from '../random.ts';
import {
  PLACEMENT_LENGTH,
  placementEligible,
  placementLevel,
  placementNext,
  placementPool,
  placementResult,
  type PlacementAnswer,
} from './placement.ts';

const q = (id: string, tier: Tier, overrides: Partial<McqQuestion> = {}): McqQuestion =>
  mcq({ id, tier, pack: 'p', status: 'verified', verified_on: '2026-01-02', ...overrides });

let n = 0;
const a = (tier: Tier, correct: boolean, id = `${tier}-${(n += 1)}`): PlacementAnswer => ({
  questionId: id,
  tier,
  correct,
});

const pool = [
  ...Array.from({ length: 6 }, (_, i) => q(`f${i}`, 'foundational')),
  ...Array.from({ length: 6 }, (_, i) => q(`a${i}`, 'advanced')),
  ...Array.from({ length: 6 }, (_, i) => q(`x${i}`, 'expert')),
];

describe('placement', () => {
  it('is offered from 60 verified questions', () => {
    expect(placementEligible(59)).toBe(false);
    expect(placementEligible(60)).toBe(true);
  });

  it('draws verified auto-graded questions of the subject only', () => {
    const extra = [
      recall({ id: 'r', pack: 'p', status: 'verified', verified_on: '2026-01-02' }),
      q('draft', 'foundational', { status: 'draft' }),
      q('elsewhere', 'foundational', { pack: 'other' }),
    ];
    const ids = placementPool([...pool, ...extra], ['p']).map((x) => x.id);
    expect(ids).toHaveLength(18);
    expect(ids).not.toContain('r');
  });

  it('steps up after two right and down after a miss', () => {
    expect(placementLevel([])).toBe(0);
    expect(placementLevel([a('foundational', true), a('foundational', true)])).toBe(1);
    const up2 = [true, true, true, true].map((c) => a('foundational', c));
    expect(placementLevel(up2)).toBe(2);
    expect(placementLevel([...up2, a('expert', false)])).toBe(1);
    expect(placementLevel([a('foundational', false)])).toBe(0);
  });

  it('asks at the current level and stops after the quiz length', () => {
    const random = seededRandom(3);
    const answers: PlacementAnswer[] = [];
    for (let i = 0; i < 20; i += 1) {
      const next = placementNext(answers, pool, random);
      if (!next) break;
      expect(answers.some((x) => x.questionId === next.id)).toBe(false);
      answers.push({ questionId: next.id, tier: next.tier, correct: true });
    }
    expect(answers).toHaveLength(PLACEMENT_LENGTH);
    expect(answers.map((x) => x.tier).slice(0, 4)).toEqual([
      'foundational',
      'foundational',
      'advanced',
      'advanced',
    ]);
    expect(answers.at(-1)?.tier).toBe('expert');
  });

  it('falls back to a nearby tier and ends when the pool is empty', () => {
    const small = [q('f0', 'foundational'), q('a0', 'advanced')];
    const random = seededRandom(1);
    const first = placementNext([], small, random);
    expect(first?.id).toBe('f0');
    const second = placementNext([a('foundational', true, 'f0')], small, random);
    expect(second?.id).toBe('a0');
    expect(
      placementNext([a('foundational', true, 'f0'), a('advanced', true, 'a0')], small, random),
    ).toBeUndefined();
  });

  it('places at the highest tier passed with every lower tier passed', () => {
    expect(placementResult([])).toBe('foundational');
    const f = [a('foundational', true), a('foundational', true)];
    expect(placementResult([...f, a('advanced', true), a('advanced', true)])).toBe('advanced');
    expect(
      placementResult([...f, a('advanced', true), a('advanced', false), a('advanced', true)]),
    ).toBe('advanced');
    expect(placementResult([...f, a('advanced', true), a('advanced', false)])).toBe('foundational');
    // Expert passed but advanced not: stays at foundational.
    expect(placementResult([...f, a('expert', true), a('expert', true)])).toBe('foundational');
  });
});
