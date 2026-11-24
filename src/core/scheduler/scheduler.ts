import type { Rating } from '../sync/reviewEvent.ts';

/**
 * Scheduling is wrapped behind this interface (CLAUDE.md); the FSRS library
 * stays an implementation detail. State is plain JSON with UTC ms timestamps.
 */
export type SchedulerPhase = 'learning' | 'review' | 'relearning';

export interface SchedulerState {
  /** When the card is next due (UTC ms). */
  readonly due: number;
  readonly stability: number;
  readonly difficulty: number;
  /** Scheduled reviews so far. */
  readonly reps: number;
  readonly lapses: number;
  readonly phase: SchedulerPhase;
  readonly lastReview: number;
  /** Interval chosen at the last review, in days. */
  readonly scheduledDays: number;
}

export interface Scheduler {
  /** Apply one review. `state` is null for a card's first scheduled review. */
  review(state: SchedulerState | null, rating: Rating, now: number): SchedulerState;
  /** Probability of recall at `now`, 0..1. */
  retrievability(state: SchedulerState, now: number): number;
}

export const RETENTION_MIN = 0.8;
export const RETENTION_MAX = 0.95;
export const RETENTION_DEFAULT = 0.9;
