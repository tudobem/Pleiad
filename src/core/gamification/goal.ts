import { learningDay } from '../scheduler/day.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

/** Answers per learning day (04:00 boundary), scheduled and extra alike. */
export function answersPerDay(
  events: readonly ReviewEvent[],
  offsetMinutes: number,
): Map<number, number> {
  const perDay = new Map<number, number>();
  for (const e of events) {
    const d = learningDay(e.ts, offsetMinutes);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  return perDay;
}

/** Week number of a learning day; weeks run Monday to Sunday (day 0 was a Thursday). */
export function weekOf(day: number): number {
  return Math.floor((day + 3) / 7);
}

/** First learning day of a week. */
export function weekStart(week: number): number {
  return week * 7 - 3;
}

export interface GoalProgress {
  readonly done: number;
  readonly goal: number;
  /** 0..1 */
  readonly ratio: number;
  readonly met: boolean;
}

export function goalProgress(
  perDay: ReadonlyMap<number, number>,
  today: number,
  goal: number,
): GoalProgress {
  const done = perDay.get(today) ?? 0;
  return { done, goal, ratio: Math.min(1, done / goal), met: done >= goal };
}

export interface GoalStreak {
  readonly current: number;
  readonly longest: number;
}

/**
 * Days that met the daily goal in a row (SPEC 15). One missed day per week
 * (Monday to Sunday) is forgiven: it keeps the streak but does not add to it.
 * Today counts once met; until then the streak runs up to yesterday.
 */
export function goalStreak(
  perDay: ReadonlyMap<number, number>,
  today: number,
  goal: number,
): GoalStreak {
  const met = (d: number) => (perDay.get(d) ?? 0) >= goal;
  const days = [...perDay.keys()].filter((d) => d <= today && met(d)).sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, longest: 0 };

  // A missed day can be forgiven once per week, and only between met days.
  const run = (from: number, step: 1 | -1, stop: (d: number) => boolean): number => {
    const graced = new Set<number>();
    let count = 0;
    for (let d = from; !stop(d); d += step) {
      if (met(d)) count += 1;
      else if (!graced.has(weekOf(d)) && met(d + step)) graced.add(weekOf(d));
      else break;
    }
    return count;
  };

  // Current: back from today (today counts once met; until then it is still open).
  const first = days[0] as number;
  const current = run(met(today) ? today : today - 1, -1, (d) => d < first);

  // Longest: the best run starting at any met day that follows a break.
  let longest = 0;
  for (const d of days) {
    if (met(d - 1)) continue;
    longest = Math.max(
      longest,
      run(d, 1, (x) => x > today),
    );
  }
  return { current, longest: Math.max(longest, current) };
}
