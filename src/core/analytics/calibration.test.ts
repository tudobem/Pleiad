import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../scheduler/day.ts';
import { reviewEvent } from '../storageContract.test-util.ts';
import type { Confidence, ReviewEvent } from '../sync/reviewEvent.ts';
import { calibratedWeeks, calibration, verdictFor } from './calibration.ts';

let seq = 0;
const ev = (
  confidence: Confidence | undefined,
  correct: boolean,
  cardId = 'a',
  ts = Date.UTC(2026, 10, 24, 12),
): ReviewEvent =>
  reviewEvent({
    eventId: `e${(seq += 1)}`,
    cardId,
    ts,
    correct,
    rating: correct ? 'good' : 'again',
    ...(confidence ? { confidence } : {}),
  });
const ctx = {
  subjectOf: (id: string) => (id.startsWith('p') ? 'philosophy' : 'science'),
  tierOf: (id: string) => (id.endsWith('2') ? 'advanced' : 'foundational'),
};

describe('calibration', () => {
  it('computes Brier score, bias and the curve', () => {
    const events = [
      ev('certain', true),
      ev('certain', false),
      ev('guess', false),
      ev('fairly_sure', true),
      ev(undefined, true),
    ];
    const c = calibration(events, ctx);
    expect(c.answered).toBe(4);
    // (0.05² + 0.95² + 0.35² + 0.3²) / 4
    expect(c.brier).toBeCloseTo((0.0025 + 0.9025 + 0.1225 + 0.09) / 4, 10);
    // mean stated (0.95+0.95+0.35+0.7)/4 = 0.7375, correct 0.5
    expect(c.bias).toBeCloseTo(0.2375, 10);
    expect(c.verdict).toBe('overconfident');
    expect(c.levels.map((l) => [l.key, l.count, l.correct])).toEqual([
      ['guess', 1, 0],
      ['fairly_sure', 1, 1],
      ['certain', 2, 0.5],
    ]);
  });

  it('groups by subject and tier and handles no data', () => {
    const events = [ev('certain', true, 'p1'), ev('guess', true, 'p2'), ev('certain', false, 's1')];
    const c = calibration(events, ctx);
    expect(c.bySubject.map((r) => [r.key, r.count])).toEqual([
      ['philosophy', 2],
      ['science', 1],
    ]);
    expect(c.byTier.map((r) => [r.key, r.count])).toEqual([
      ['foundational', 2],
      ['advanced', 1],
    ]);
    expect(calibration([ev(undefined, true)], ctx)).toMatchObject({
      answered: 0,
      brier: null,
      verdict: null,
    });
  });

  it('names the verdict from the bias', () => {
    expect([0.2, -0.2, 0.03, -0.05].map(verdictFor)).toEqual([
      'overconfident',
      'underconfident',
      'calibrated',
      'calibrated',
    ]);
  });

  it('finds weeks with enough answers and a small bias', () => {
    const t = Date.UTC(2026, 10, 24, 12);
    // 30 Fairly sure answers, 21 right (0.70): calibrated.
    const good = Array.from({ length: 30 }, (_, i) => ev('fairly_sure', i < 21, 'a', t + i));
    // Next week: 30 Certain answers, half right: overconfident.
    const bad = Array.from({ length: 30 }, (_, i) =>
      ev('certain', i % 2 === 0, 'a', t + 7 * DAY_MS + i),
    );
    const weeks = calibratedWeeks([...good, ...bad], 0);
    expect(weeks).toHaveLength(1);
    expect(calibratedWeeks(good.slice(0, 29), 0)).toEqual([]);
  });
});
