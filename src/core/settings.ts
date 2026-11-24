import { RETENTION_DEFAULT } from './scheduler/scheduler.ts';
import { clampRetention } from './scheduler/fsrsScheduler.ts';
import type { Tier } from './content/types.ts';

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
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  reviewCap: 150,
  desiredRetention: RETENTION_DEFAULT,
  tierMix: { foundational: 60, advanced: 30, expert: 10 },
  autoUnlock: true,
};

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
  };
}
