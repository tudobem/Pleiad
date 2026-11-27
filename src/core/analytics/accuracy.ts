import { DAY_MS } from '../scheduler/day.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

/** Accuracy looks at this many recent days. */
export const ACCURACY_WINDOW_DAYS = 30;

export interface Accuracy {
  /** Answers in the window. */
  readonly answered: number;
  readonly right: number;
  /** right / answered, or null without answers. */
  readonly share: number | null;
}

export function accuracyFrom(answered: number, right: number): Accuracy {
  return { answered, right, share: answered === 0 ? null : right / answered };
}

/**
 * Share of answers that were right in the last 30 days, scheduled and extra
 * practice alike. A recall item rated Again counts as wrong.
 */
export function accuracyOf(
  events: readonly ReviewEvent[],
  now: number,
  ids?: ReadonlySet<string>,
  windowDays = ACCURACY_WINDOW_DAYS,
): Accuracy {
  const since = now - windowDays * DAY_MS;
  let answered = 0;
  let right = 0;
  for (const e of events) {
    if (e.ts < since || e.ts > now) continue;
    if (ids && !ids.has(e.cardId)) continue;
    answered += 1;
    if (e.correct) right += 1;
  }
  return accuracyFrom(answered, right);
}

/** Recent accuracy per card, for grouping into topics without rescanning. */
export function recentByCard(
  events: readonly ReviewEvent[],
  now: number,
  windowDays = ACCURACY_WINDOW_DAYS,
): Map<string, { answered: number; right: number }> {
  const since = now - windowDays * DAY_MS;
  const byCard = new Map<string, { answered: number; right: number }>();
  for (const e of events) {
    if (e.ts < since || e.ts > now) continue;
    const c = byCard.get(e.cardId) ?? { answered: 0, right: 0 };
    c.answered += 1;
    if (e.correct) c.right += 1;
    byCard.set(e.cardId, c);
  }
  return byCard;
}
