import { RETENTION_DEFAULT } from './scheduler/scheduler.ts';
import { clampRetention } from './scheduler/fsrsScheduler.ts';
import type { Tier } from './content/types.ts';
import { DEFAULT_DRILL_SIZE, DRILL_SIZES, type DrillSize } from './session/drill.ts';

/** Learning settings (SPEC 7). Stored in the `settings` store; UI comes later. */
export interface Settings {
  /** New items introduced per learning day (0 to 50). */
  readonly newPerDay: number;
  /** Soft cap on scheduled reviews per day. */
  readonly reviewCap: number;
  /** FSRS desired retention (0.80 to 0.95). */
  readonly desiredRetention: number;
  /** Relative weights of tiers among new items (SPEC 7.2). */
  readonly tierMix: Readonly<Record<Tier, number>>;
  /** Unlock advanced/expert items per topic automatically (SPEC 7.2). */
  readonly autoUnlock: boolean;
  /**
   * Packs the Daily queue draws from (SPEC 5.3). Unset means every pack is
   * active; the first explicit change stores the full list.
   */
  readonly activePacks?: readonly string[];
  /** Daily goal in answers (SPEC 15). Never read by the queue or scheduler. */
  readonly dailyGoal: number;
  /** Show goal, streak and rewards (SPEC 15: everything can be turned off). */
  readonly rewards: boolean;
  /** Ask Guess / Fairly sure / Certain before MCQ and short answers (SPEC 9). */
  readonly confidencePrompts: boolean;
  /** Length of Practice drills (SPEC 8): 10, 20 or every match. */
  readonly drillSize: DrillSize;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  reviewCap: 150,
  desiredRetention: RETENTION_DEFAULT,
  tierMix: { foundational: 60, advanced: 30, expert: 10 },
  autoUnlock: true,
  dailyGoal: 20,
  rewards: true,
  confidencePrompts: true,
  drillSize: DEFAULT_DRILL_SIZE,
};

export const DAILY_GOAL_MIN = 5;
export const DAILY_GOAL_MAX = 200;

const intIn = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : fallback;

/** Merge stored values over defaults and clamp them to valid ranges. */
export function normalizeSettings(stored: Partial<Settings> | undefined): Settings {
  const s = stored ?? {};
  const mix = s.tierMix ?? DEFAULT_SETTINGS.tierMix;
  const tierMix = {
    foundational: intIn(mix.foundational, 0, 100, DEFAULT_SETTINGS.tierMix.foundational),
    advanced: intIn(mix.advanced, 0, 100, DEFAULT_SETTINGS.tierMix.advanced),
    expert: intIn(mix.expert, 0, 100, DEFAULT_SETTINGS.tierMix.expert),
  };
  const mixTotal = tierMix.foundational + tierMix.advanced + tierMix.expert;
  return {
    newPerDay: intIn(s.newPerDay, 0, 50, DEFAULT_SETTINGS.newPerDay),
    reviewCap: intIn(s.reviewCap, 0, 9999, DEFAULT_SETTINGS.reviewCap),
    desiredRetention: clampRetention(s.desiredRetention ?? DEFAULT_SETTINGS.desiredRetention),
    tierMix: mixTotal > 0 ? tierMix : DEFAULT_SETTINGS.tierMix,
    autoUnlock: typeof s.autoUnlock === 'boolean' ? s.autoUnlock : DEFAULT_SETTINGS.autoUnlock,
    dailyGoal: intIn(s.dailyGoal, DAILY_GOAL_MIN, DAILY_GOAL_MAX, DEFAULT_SETTINGS.dailyGoal),
    rewards: typeof s.rewards === 'boolean' ? s.rewards : DEFAULT_SETTINGS.rewards,
    confidencePrompts:
      typeof s.confidencePrompts === 'boolean'
        ? s.confidencePrompts
        : DEFAULT_SETTINGS.confidencePrompts,
    drillSize: (DRILL_SIZES as readonly unknown[]).includes(s.drillSize)
      ? (s.drillSize as DrillSize)
      : DEFAULT_SETTINGS.drillSize,
    ...(Array.isArray(s.activePacks)
      ? {
          activePacks: [
            ...new Set(s.activePacks.filter((id): id is string => typeof id === 'string')),
          ],
        }
      : {}),
  };
}

/** Active pack IDs among the packs that exist (all of them while unset). */
export function resolveActivePacks(settings: Settings, packIds: readonly string[]): string[] {
  if (!settings.activePacks) return [...packIds];
  const active = new Set(settings.activePacks);
  return packIds.filter((id) => active.has(id));
}

/** Settings with the given packs turned on or off; the result always lists its packs. */
export function withPacksActive(
  settings: Settings,
  packIds: readonly string[],
  changed: readonly string[],
  on: boolean,
): Settings {
  const active = new Set(resolveActivePacks(settings, packIds));
  for (const id of changed) {
    if (on) active.add(id);
    else active.delete(id);
  }
  return { ...settings, activePacks: packIds.filter((id) => active.has(id)) };
}
