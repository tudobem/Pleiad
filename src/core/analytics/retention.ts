import type { Scheduler } from '../scheduler/scheduler.ts';
import { introduced } from '../session/dailyQueue.ts';
import type { CardState } from '../sync/replay.ts';

export interface Mastery {
  /** Mean FSRS retrievability now over started items (SPEC 14.1); null if none started. */
  readonly retention: number | null;
  /** Verified items introduced into the schedule. */
  readonly started: number;
  readonly verified: number;
}

/** Retention and coverage over the given verified question IDs. */
export function masteryOf(
  ids: readonly string[],
  cards: ReadonlyMap<string, CardState>,
  scheduler: Scheduler,
  now: number,
): Mastery {
  let started = 0;
  let sum = 0;
  for (const id of ids) {
    const state = cards.get(id)?.scheduler;
    if (!state || !introduced(cards, id)) continue;
    started += 1;
    sum += scheduler.retrievability(state, now);
  }
  return { retention: started > 0 ? sum / started : null, started, verified: ids.length };
}

/** Share of verified items introduced, 0..1 (0 when there are none). */
export function coverageOf(m: Mastery): number {
  return m.verified === 0 ? 0 : m.started / m.verified;
}
