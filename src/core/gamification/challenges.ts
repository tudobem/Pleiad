import { learningDay } from '../scheduler/day.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { weekOf } from './goal.ts';

export const CHALLENGE_REWARD = 100;

export type ChallengeId = 'answers' | 'goal-days' | 'recover' | 'start' | 'topics';

/** The fixed list; one per week, chosen by week number (SPEC 15). */
export const CHALLENGES: readonly { readonly id: ChallengeId; readonly target: number }[] = [
  { id: 'answers', target: 100 },
  { id: 'goal-days', target: 5 },
  { id: 'recover', target: 5 },
  { id: 'start', target: 15 },
  { id: 'topics', target: 5 },
];

export function challengeFor(week: number): { readonly id: ChallengeId; readonly target: number } {
  const n = CHALLENGES.length;
  return CHALLENGES[((week % n) + n) % n] as (typeof CHALLENGES)[number];
}

export interface ChallengeContext {
  readonly offsetMinutes: number;
  readonly goal: number;
  readonly topicOf: (cardId: string) => string | undefined;
  /** Recovery events (correct right after a miss), from xpForEvents. */
  readonly recoveries: readonly ReviewEvent[];
}

export interface ChallengeProgress {
  readonly week: number;
  readonly id: ChallengeId;
  readonly target: number;
  readonly value: number;
  readonly done: boolean;
  readonly reward: number;
}

/** Progress on the week's challenge, counting only that week's answers. */
export function challengeProgress(
  events: readonly ReviewEvent[],
  week: number,
  ctx: ChallengeContext,
): ChallengeProgress {
  const { id, target } = challengeFor(week);
  const inWeek = (e: ReviewEvent) => weekOf(learningDay(e.ts, ctx.offsetMinutes)) === week;
  const weekEvents = events.filter(inWeek);
  let value = 0;
  switch (id) {
    case 'answers':
      value = weekEvents.length;
      break;
    case 'goal-days': {
      const perDay = new Map<number, number>();
      for (const e of weekEvents) {
        const d = learningDay(e.ts, ctx.offsetMinutes);
        perDay.set(d, (perDay.get(d) ?? 0) + 1);
      }
      value = [...perDay.values()].filter((n) => n >= ctx.goal).length;
      break;
    }
    case 'recover':
      value = ctx.recoveries.filter(inWeek).length;
      break;
    case 'start': {
      // Cards whose first scheduled answer falls in this week.
      const first = new Map<string, ReviewEvent>();
      for (const e of events) {
        if (e.mode !== 'scheduled') continue;
        const seen = first.get(e.cardId);
        if (!seen || e.ts < seen.ts) first.set(e.cardId, e);
      }
      value = [...first.values()].filter(inWeek).length;
      break;
    }
    case 'topics':
      value = new Set(weekEvents.map((e) => ctx.topicOf(e.cardId)).filter(Boolean)).size;
      break;
  }
  return { week, id, target, value, done: value >= target, reward: CHALLENGE_REWARD };
}

/** Weeks whose challenge was completed, from the first answer up to `currentWeek`. */
export function completedChallenges(
  events: readonly ReviewEvent[],
  currentWeek: number,
  ctx: ChallengeContext,
): ChallengeProgress[] {
  if (events.length === 0) return [];
  const firstWeek = Math.min(...events.map((e) => weekOf(learningDay(e.ts, ctx.offsetMinutes))));
  const done: ChallengeProgress[] = [];
  for (let w = firstWeek; w <= currentWeek; w += 1) {
    const p = challengeProgress(events, w, ctx);
    if (p.done) done.push(p);
  }
  return done;
}
