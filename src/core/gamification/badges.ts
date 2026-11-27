/** About eight milestone badges (SPEC 15), all derived from the log (nine with True North, M10). */
export type BadgeId =
  | 'first-light'
  | 'century'
  | 'week-of-light'
  | 'steady-orbit'
  | 'comeback'
  | 'explorer'
  | 'bright-star'
  | 'challenger'
  | 'true-north';

export interface BadgeFacts {
  readonly answers: number;
  readonly longestGoalStreak: number;
  /** Different cards recovered after a miss. */
  readonly recoveredCards: number;
  /** Topics with at least one started question. */
  readonly topicsStarted: number;
  /** A subject with >= 20 started items at >= 80% retention. */
  readonly brightSubject: boolean;
  readonly challengesDone: number;
  /** Weeks whose confidence was well calibrated (SPEC 9). */
  readonly calibratedWeeks: number;
}

export const BADGES: readonly {
  readonly id: BadgeId;
  readonly earned: (f: BadgeFacts) => boolean;
}[] = [
  { id: 'first-light', earned: (f) => f.answers >= 1 },
  { id: 'century', earned: (f) => f.answers >= 100 },
  { id: 'week-of-light', earned: (f) => f.longestGoalStreak >= 7 },
  { id: 'steady-orbit', earned: (f) => f.longestGoalStreak >= 30 },
  { id: 'comeback', earned: (f) => f.recoveredCards >= 10 },
  { id: 'explorer', earned: (f) => f.topicsStarted >= 10 },
  { id: 'bright-star', earned: (f) => f.brightSubject },
  { id: 'challenger', earned: (f) => f.challengesDone >= 1 },
  { id: 'true-north', earned: (f) => f.calibratedWeeks >= 1 },
];

export function badgeStates(
  facts: BadgeFacts,
): { readonly id: BadgeId; readonly earned: boolean }[] {
  return BADGES.map((b) => ({ id: b.id, earned: b.earned(facts) }));
}
