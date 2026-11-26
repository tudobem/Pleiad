import type { Question } from '../content/types.ts';
import { DAY_MS } from '../scheduler/day.ts';
import type { Scheduler } from '../scheduler/scheduler.ts';
import type { CardState } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

/** SPEC 7.4: cards with this many lapses are leeches. */
export const LEECH_LAPSES = 6;
export const WEAK_WINDOW_DAYS = 30;
/** Retrievability below this lists a card even without a recent miss. */
export const WEAK_RETRIEVABILITY = 0.8;
export const WEAK_LIMIT = 10;

export interface WeakSpot {
  readonly questionId: string;
  readonly topic: string;
  readonly score: number;
  /** Misses in the window, scheduled and extra practice. */
  readonly misses: number;
  readonly leech: boolean;
  readonly retrievability: number;
  /** Wrong answers given with "Certain" confidence (SPEC 9). */
  readonly confidentErrors: number;
}

export interface WeakSpotInput {
  readonly questions: ReadonlyMap<string, Question>;
  readonly cards: ReadonlyMap<string, CardState>;
  readonly events: readonly ReviewEvent[];
  readonly scheduler: Scheduler;
  readonly now: number;
  readonly limit?: number;
}

/**
 * The weak-spot list (SPEC 14.2): started cards ranked by recent misses, low
 * retrievability, leech status and high-confidence errors.
 */
export function weakSpots(input: WeakSpotInput): WeakSpot[] {
  const { questions, cards, events, scheduler, now, limit = WEAK_LIMIT } = input;
  const since = now - WEAK_WINDOW_DAYS * DAY_MS;
  const misses = new Map<string, number>();
  const confident = new Map<string, number>();
  for (const e of events) {
    if (e.correct || e.ts < since || e.ts > now) continue;
    misses.set(e.cardId, (misses.get(e.cardId) ?? 0) + 1);
    if (e.confidence === 'certain') confident.set(e.cardId, (confident.get(e.cardId) ?? 0) + 1);
  }

  const spots: WeakSpot[] = [];
  for (const [id, q] of questions) {
    const state = cards.get(id)?.scheduler;
    if (!state) continue;
    const r = scheduler.retrievability(state, now);
    const m = misses.get(id) ?? 0;
    const c = confident.get(id) ?? 0;
    const leech = state.lapses >= LEECH_LAPSES;
    if (m === 0 && r >= WEAK_RETRIEVABILITY) continue;
    const score = 2 * m + 3 * (1 - r) + (leech ? 3 : 0) + 2 * c;
    spots.push({
      questionId: id,
      topic: q.topic,
      score,
      misses: m,
      leech,
      retrievability: r,
      confidentErrors: c,
    });
  }
  return spots
    .sort((a, b) => b.score - a.score || (a.questionId < b.questionId ? -1 : 1))
    .slice(0, limit);
}
