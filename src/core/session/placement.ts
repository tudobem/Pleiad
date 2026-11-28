import { TIERS, type Question, type Tier } from '../content/types.ts';
import { shuffle, type Random } from '../random.ts';
import { sessionEligible } from './session.ts';

/** SPEC 13: placement is offered once a subject has about this many verified questions. */
export const PLACEMENT_MIN_VERIFIED = 60;
/** Questions in one placement quiz. */
export const PLACEMENT_LENGTH = 10;
/** Right answers in a row at a level that move the quiz up a tier. */
const STEP_UP_STREAK = 2;

/** Auto-graded types only: recall is self-rated, so it says little about level. */
const PLACEMENT_TYPES: readonly Question['type'][] = [
  'mcq',
  'short',
  'cloze',
  'match',
  'order',
  'estimation',
  'timeline',
];

export interface PlacementAnswer {
  readonly questionId: string;
  readonly tier: Tier;
  readonly correct: boolean;
}

export function placementEligible(verified: number): boolean {
  return verified >= PLACEMENT_MIN_VERIFIED;
}

/** Questions a placement quiz can ask: verified, auto-graded, in the given packs. */
export function placementPool(questions: Iterable<Question>, packs: readonly string[]): Question[] {
  return sessionEligible([...questions]).filter(
    (q) => packs.includes(q.pack) && PLACEMENT_TYPES.includes(q.type),
  );
}

/**
 * The staircase level after these answers (as a tier index): start at
 * foundational, two right in a row move up a tier, a miss moves down one.
 */
export function placementLevel(answers: readonly PlacementAnswer[]): number {
  let level = 0;
  let streak = 0;
  for (const a of answers) {
    if (a.correct) {
      streak += 1;
      if (streak >= STEP_UP_STREAK && level < TIERS.length - 1) {
        level += 1;
        streak = 0;
      }
    } else {
      streak = 0;
      level = Math.max(0, level - 1);
    }
  }
  return level;
}

/**
 * The next question to ask, or undefined when the quiz is over (enough
 * questions, or nothing left to ask). Picks an unasked question at the
 * current level, else from the nearest tier that still has one.
 */
export function placementNext(
  answers: readonly PlacementAnswer[],
  pool: readonly Question[],
  random: Random,
): Question | undefined {
  if (answers.length >= PLACEMENT_LENGTH) return undefined;
  const asked = new Set(answers.map((a) => a.questionId));
  const level = placementLevel(answers);
  const order = [level, level + 1, level - 1, level + 2, level - 2].filter(
    (i) => i >= 0 && i < TIERS.length,
  );
  for (const i of order) {
    const options = pool.filter((q) => q.tier === TIERS[i] && !asked.has(q.id));
    if (options.length > 0) return shuffle(options, random)[0];
  }
  return undefined;
}

/**
 * The placed level: the highest tier answered at least twice with at least
 * two thirds right, every lower tier passing too; foundational otherwise.
 */
export function placementResult(answers: readonly PlacementAnswer[]): Tier {
  let placed: Tier = 'foundational';
  for (const tier of TIERS) {
    const at = answers.filter((a) => a.tier === tier);
    const right = at.filter((a) => a.correct).length;
    if (at.length < 2 || right * 3 < at.length * 2) break;
    placed = tier;
  }
  return placed;
}
