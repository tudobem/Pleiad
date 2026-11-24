import { describe, expect, it } from 'vitest';
import { clampRetention, fsrsScheduler } from './fsrsScheduler.ts';
import { DAY_MS } from './day.ts';
import type { SchedulerState } from './scheduler.ts';

const T0 = Date.UTC(2026, 10, 24, 12);
const days = (s: SchedulerState, from = T0) => (s.due - from) / DAY_MS;

describe('fsrsScheduler', () => {
  const scheduler = fsrsScheduler();

  it('schedules a first review further out for better ratings', () => {
    const again = scheduler.review(null, 'again', T0);
    const hard = scheduler.review(null, 'hard', T0);
    const good = scheduler.review(null, 'good', T0);
    const easy = scheduler.review(null, 'easy', T0);
    expect(days(again)).toBeGreaterThanOrEqual(1);
    expect(days(hard)).toBeLessThanOrEqual(days(good));
    expect(days(good)).toBeLessThan(days(easy));
    for (const s of [again, hard, good, easy]) {
      expect(s.reps).toBe(1);
      expect(s.lastReview).toBe(T0);
      expect(Number.isInteger(days(s))).toBe(true);
    }
  });

  it('grows intervals on success and counts a lapse on failure', () => {
    const first = scheduler.review(null, 'good', T0);
    const second = scheduler.review(first, 'good', first.due);
    expect(second.phase).toBe('review');
    expect(days(second, first.due)).toBeGreaterThan(days(first));
    const lapse = scheduler.review(second, 'again', second.due);
    expect(lapse.lapses).toBe(1);
    // With short-term steps off, FSRS keeps lapsed cards in the review phase.
    expect(lapse.phase).toBe('review');
    expect(days(lapse, second.due)).toBeLessThan(days(second, first.due));
  });

  it('is deterministic and survives a JSON round trip', () => {
    const a = scheduler.review(scheduler.review(null, 'good', T0), 'hard', T0 + 5 * DAY_MS);
    const b = fsrsScheduler().review(
      JSON.parse(JSON.stringify(scheduler.review(null, 'good', T0))) as SchedulerState,
      'hard',
      T0 + 5 * DAY_MS,
    );
    expect(b).toEqual(a);
  });

  it('schedules sooner for a higher desired retention', () => {
    const base = fsrsScheduler(0.8).review(null, 'good', T0);
    const s80 = fsrsScheduler(0.8).review(base, 'good', base.due);
    const s95 = fsrsScheduler(0.95).review(base, 'good', base.due);
    expect(s95.due).toBeLessThan(s80.due);
  });

  it('reports retrievability that decays over time', () => {
    const s = scheduler.review(null, 'good', T0);
    const soon = scheduler.retrievability(s, T0 + DAY_MS);
    const later = scheduler.retrievability(s, T0 + 30 * DAY_MS);
    expect(soon).toBeGreaterThan(later);
    expect(soon).toBeLessThanOrEqual(1);
    expect(later).toBeGreaterThan(0);
  });

  it('clamps retention to the allowed range', () => {
    expect(clampRetention(0.5)).toBe(0.8);
    expect(clampRetention(0.99)).toBe(0.95);
    expect(clampRetention(Number.NaN)).toBe(0.9);
  });
});
