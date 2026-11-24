import type { Tier } from '../content/types.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

/** SPEC 7.3: a correct answer slower than 3x the tier median counts as Hard. */
export const SLOW_FACTOR = 3;
/** Medians are only trusted once a tier has this many scheduled reviews. */
export const SLOW_MIN_SAMPLES = 10;

export type SlowThresholds = Partial<Record<Tier, number>>;

export function slowThresholds(
  events: readonly ReviewEvent[],
  tierOf: (cardId: string) => Tier | undefined,
): SlowThresholds {
  const byTier = new Map<Tier, number[]>();
  for (const e of events) {
    if (e.mode !== 'scheduled') continue;
    const tier = tierOf(e.cardId);
    if (!tier) continue;
    byTier.set(tier, [...(byTier.get(tier) ?? []), e.responseMs]);
  }
  const out: SlowThresholds = {};
  for (const [tier, times] of byTier) {
    if (times.length < SLOW_MIN_SAMPLES) continue;
    out[tier] = median(times) * SLOW_FACTOR;
  }
  return out;
}

export function isSlow(thresholds: SlowThresholds, tier: Tier, responseMs: number): boolean {
  const limit = thresholds[tier];
  return limit !== undefined && responseMs > limit;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
