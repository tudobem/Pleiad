import type { Rating, ReviewEvent } from './reviewEvent.ts';

/**
 * Minimal card state derived from the review log. The `cards` store is only
 * a cache of this; it can always be rebuilt by replay (SPEC 3.3, 19).
 * M3 extends this with FSRS state from scheduled events.
 */
export interface CardState {
  readonly cardId: string;
  /** First time the card was reviewed in any mode. */
  readonly introducedTs: number;
  readonly lastReviewTs: number;
  readonly lastRating: Rating;
  /** Scheduled reviews only (extra practice does not count, SPEC 7.6). */
  readonly reps: number;
  readonly lapses: number;
  /** All attempts including extra practice. */
  readonly attempts: number;
  readonly misses: number;
}

/** Canonical event order: by timestamp, then eventId to break ties. */
export function compareEvents(a: ReviewEvent, b: ReviewEvent): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
}

/**
 * Deterministic replay: the same set of events gives the same states in any
 * input order. Duplicate eventIds (e.g. after a merge) count once.
 */
export function replayCards(events: readonly ReviewEvent[]): Map<string, CardState> {
  const seen = new Set<string>();
  const ordered = [...events].sort(compareEvents).filter((e) => {
    if (seen.has(e.eventId)) return false;
    seen.add(e.eventId);
    return true;
  });
  const cards = new Map<string, CardState>();
  for (const e of ordered) {
    const prev = cards.get(e.cardId);
    const scheduled = e.mode === 'scheduled';
    cards.set(e.cardId, {
      cardId: e.cardId,
      introducedTs: prev?.introducedTs ?? e.ts,
      lastReviewTs: e.ts,
      lastRating: e.rating,
      reps: (prev?.reps ?? 0) + (scheduled ? 1 : 0),
      lapses:
        (prev?.lapses ?? 0) + (scheduled && e.rating === 'again' && (prev?.reps ?? 0) > 0 ? 1 : 0),
      attempts: (prev?.attempts ?? 0) + 1,
      misses: (prev?.misses ?? 0) + (e.correct ? 0 : 1),
    });
  }
  return cards;
}
