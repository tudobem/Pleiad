import { compareEvents } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

/** Bonus for a correct answer given as "Certain" (SPEC 15). */
export const CONFIDENT_BONUS = 1;
/** Bonus for answering correctly right after a miss on the same card. */
export const RECOVERY_BONUS = 2;

export interface XpResult {
  readonly total: number;
  readonly byCard: ReadonlyMap<string, number>;
  /** Events that were recoveries (correct right after a miss on that card). */
  readonly recoveries: readonly ReviewEvent[];
}

/**
 * XP from the review log (SPEC 15): 1, 2 or 3 per correct answer by tier,
 * plus small bonuses. Derived only from the log, so it replays exactly.
 */
export function xpForEvents(
  events: readonly ReviewEvent[],
  tierOf: (cardId: string) => number,
): XpResult {
  const lastCorrect = new Map<string, boolean>();
  const byCard = new Map<string, number>();
  const recoveries: ReviewEvent[] = [];
  let total = 0;
  for (const e of [...events].sort(compareEvents)) {
    const before = lastCorrect.get(e.cardId);
    lastCorrect.set(e.cardId, e.correct);
    if (!e.correct) continue;
    let xp = tierOf(e.cardId);
    if (e.confidence === 'certain') xp += CONFIDENT_BONUS;
    if (before === false) {
      xp += RECOVERY_BONUS;
      recoveries.push(e);
    }
    total += xp;
    byCard.set(e.cardId, (byCard.get(e.cardId) ?? 0) + xp);
  }
  return { total, byCard, recoveries };
}

export const LEVEL_TITLES = [
  'First Light',
  'Stargazer',
  'Skywatcher',
  'Navigator',
  'Cartographer',
  'Astronomer',
  'Constellation Keeper',
  'Luminary',
] as const;

/** Total XP needed to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  return 25 * level * (level - 1);
}

export interface Level {
  readonly level: number;
  readonly title: string;
  /** XP earned since this level started. */
  readonly into: number;
  /** XP still needed for the next level. */
  readonly toNext: number;
  /** XP between this level and the next. */
  readonly span: number;
}

export function levelFor(xp: number): Level {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  // Two levels per title, the last title from level 15 on.
  const title = LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 2))] ?? '';
  return { level, title, into: xp - start, toNext: next - xp, span: next - start };
}

export const SUBJECT_TITLES: readonly (readonly [number, string])[] = [
  [1500, 'Sage'],
  [700, 'Scholar'],
  [300, 'Adept'],
  [100, 'Apprentice'],
  [0, 'Newcomer'],
];

export function subjectTitle(xp: number): string {
  return SUBJECT_TITLES.find(([min]) => xp >= min)?.[1] ?? 'Newcomer';
}
