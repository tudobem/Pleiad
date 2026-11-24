import type { Scheduler, SchedulerState } from '../scheduler/scheduler.ts';
import type { Rating, ReviewEvent } from './reviewEvent.ts';

/**
 * Card state derived from the review log. The `cards` store is only a cache
 * of this; it can always be rebuilt by replay (SPEC 3.3, 19).
 */
export interface CardState {
  readonly cardId: string;
  /** First attempt in any mode. */
  readonly firstSeenTs: number;
  /** First scheduled review, i.e. when the card entered the schedule; null if never. */
  readonly introducedTs: number | null;
  readonly lastReviewTs: number;
  readonly lastRating: Rating;
  /** FSRS state from scheduled reviews only (extra practice never changes it, SPEC 7.6). */
  readonly scheduler: SchedulerState | null;
  /** All attempts including extra practice. */
  readonly attempts: number;
  readonly misses: number;
}

/** Canonical event order: by timestamp, then eventId to break ties. */
export function compareEvents(a: ReviewEvent, b: ReviewEvent): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
}

/** Events sorted canonically, with duplicate eventIds (e.g. after a merge) kept once. */
export function canonicalEvents(events: readonly ReviewEvent[]): ReviewEvent[] {
  const seen = new Set<string>();
  return [...events].sort(compareEvents).filter((e) => {
    if (seen.has(e.eventId)) return false;
    seen.add(e.eventId);
    return true;
  });
}

/** Apply one event to a card's state. */
export function applyEvent(
  prev: CardState | undefined,
  e: ReviewEvent,
  scheduler: Scheduler,
): CardState {
  const scheduled = e.mode === 'scheduled';
  return {
    cardId: e.cardId,
    firstSeenTs: prev?.firstSeenTs ?? e.ts,
    introducedTs: prev?.introducedTs ?? (scheduled ? e.ts : null),
    lastReviewTs: e.ts,
    lastRating: e.rating,
    scheduler: scheduled
      ? scheduler.review(prev?.scheduler ?? null, e.rating, e.ts)
      : (prev?.scheduler ?? null),
    attempts: (prev?.attempts ?? 0) + 1,
    misses: (prev?.misses ?? 0) + (e.correct ? 0 : 1),
  };
}

/** Deterministic replay: the same set of events gives the same states in any input order. */
export function replayCards(
  events: readonly ReviewEvent[],
  scheduler: Scheduler,
): Map<string, CardState> {
  const cards = new Map<string, CardState>();
  for (const e of canonicalEvents(events)) {
    cards.set(e.cardId, applyEvent(cards.get(e.cardId), e, scheduler));
  }
  return cards;
}
