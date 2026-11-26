import { learningDay } from '../scheduler/day.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

export const HEATMAP_DAYS = 35;

export interface DayActivity {
  readonly day: number;
  readonly count: number;
}

export interface Activity {
  /** Answers per learning day, oldest first, ending today. */
  readonly days: readonly DayActivity[];
  readonly today: number;
  readonly total: number;
  /** Consecutive learning days with an answer, up to today (or yesterday). */
  readonly currentStreak: number;
  readonly longestStreak: number;
}

/**
 * Activity from the review log (SPEC 14.3), counted in learning days
 * (04:00 local boundary). Every answer counts, scheduled or extra.
 */
export function activity(
  events: readonly ReviewEvent[],
  now: number,
  offsetMinutes: number,
  days = HEATMAP_DAYS,
): Activity {
  const today = learningDay(now, offsetMinutes);
  const perDay = new Map<number, number>();
  for (const e of events) {
    const d = learningDay(e.ts, offsetMinutes);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const window: DayActivity[] = [];
  for (let d = today - days + 1; d <= today; d += 1) {
    window.push({ day: d, count: perDay.get(d) ?? 0 });
  }

  let longest = 0;
  let run = 0;
  let prev: number | undefined;
  for (const d of [...perDay.keys()].sort((a, b) => a - b)) {
    if (d > today) continue;
    run = prev !== undefined && d === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  let current = 0;
  let cursor = perDay.has(today) ? today : today - 1;
  while (perDay.has(cursor)) {
    current += 1;
    cursor -= 1;
  }

  return {
    days: window,
    today: perDay.get(today) ?? 0,
    total: events.length,
    currentStreak: current,
    longestStreak: longest,
  };
}

/** Intensity step 0..4 for a day's count, relative to the busiest day shown. */
export function intensity(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((4 * count) / max)));
}
