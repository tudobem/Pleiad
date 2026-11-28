import type { Settings } from '../settings.ts';

/** Pace presets (SPEC 13): new questions per day and the daily goal. */
export const PACES = {
  relaxed: { newPerDay: 5, dailyGoal: 10 },
  steady: { newPerDay: 10, dailyGoal: 20 },
  intense: { newPerDay: 20, dailyGoal: 40 },
} as const;

export type Pace = keyof typeof PACES;
export const PACE_NAMES = Object.keys(PACES) as Pace[];

/** The preset the settings match, or 'custom'. */
export function paceOf(settings: Pick<Settings, 'newPerDay' | 'dailyGoal'>): Pace | 'custom' {
  return (
    PACE_NAMES.find(
      (p) => PACES[p].newPerDay === settings.newPerDay && PACES[p].dailyGoal === settings.dailyGoal,
    ) ?? 'custom'
  );
}

/**
 * Whether to show the first-run welcome: never once it was finished or
 * skipped, and never for a profile that already has answers.
 */
export function needsOnboarding(answers: number, onboarded: boolean): boolean {
  return !onboarded && answers === 0;
}
