import { createEmptyCard, fsrs, Rating as FsrsRating, State, type Card, type Grade } from 'ts-fsrs';
import type { Rating } from '../sync/reviewEvent.ts';
import {
  RETENTION_DEFAULT,
  RETENTION_MAX,
  RETENTION_MIN,
  type Scheduler,
  type SchedulerPhase,
  type SchedulerState,
} from './scheduler.ts';

/**
 * FSRS via ts-fsrs 5.x, default parameters (SPEC 7.7). The only module that
 * imports the library. Fuzz is off so replaying the log is exactly
 * deterministic; short-term (minute) steps are off because the queue is
 * day-based: a missed item returns on a later day.
 */
const GRADES: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

const PHASES: Record<Exclude<State, State.New>, SchedulerPhase> = {
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STATES: Record<SchedulerPhase, State> = {
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export function clampRetention(value: number): number {
  if (!Number.isFinite(value)) return RETENTION_DEFAULT;
  return Math.min(RETENTION_MAX, Math.max(RETENTION_MIN, value));
}

export function fsrsScheduler(desiredRetention = RETENTION_DEFAULT): Scheduler {
  const engine = fsrs({
    request_retention: clampRetention(desiredRetention),
    enable_fuzz: false,
    enable_short_term: false,
  });

  const toCard = (s: SchedulerState): Card => ({
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: 0,
    scheduled_days: s.scheduledDays,
    learning_steps: 0,
    reps: s.reps,
    lapses: s.lapses,
    state: STATES[s.phase],
    last_review: new Date(s.lastReview),
  });

  const fromCard = (c: Card, now: number): SchedulerState => ({
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    reps: c.reps,
    lapses: c.lapses,
    phase: c.state === State.New ? 'learning' : PHASES[c.state],
    lastReview: c.last_review?.getTime() ?? now,
    scheduledDays: c.scheduled_days,
  });

  return {
    review(state, rating, now) {
      const card = state ? toCard(state) : createEmptyCard(new Date(now));
      return fromCard(engine.next(card, new Date(now), GRADES[rating]).card, now);
    },
    retrievability(state, now) {
      return engine.get_retrievability(toCard(state), new Date(now), false);
    },
  };
}
