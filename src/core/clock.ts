/**
 * All time in core comes through a Clock. Never call Date.now() in src/core.
 * Values are UTC epoch milliseconds; local-day logic (04:00 boundary) is
 * derived from these plus an explicit time-zone offset, not from the host.
 */
export interface Clock {
  now(): number;
}

/** A clock frozen at one instant. For tests and deterministic replay. */
export function fixedClock(epochMs: number): Clock {
  assertFiniteTime(epochMs);
  return { now: () => epochMs };
}

/** A manually advanced clock for tests that simulate elapsed time. */
export interface ManualClock extends Clock {
  set(epochMs: number): void;
  advance(ms: number): void;
}

export function manualClock(startEpochMs: number): ManualClock {
  assertFiniteTime(startEpochMs);
  let current = startEpochMs;
  return {
    now: () => current,
    set(epochMs) {
      assertFiniteTime(epochMs);
      current = epochMs;
    },
    advance(ms) {
      if (!Number.isFinite(ms) || ms < 0) {
        throw new RangeError(`Clock can only advance by a finite, non-negative amount: ${ms}`);
      }
      current += ms;
    },
  };
}

function assertFiniteTime(epochMs: number): void {
  if (!Number.isFinite(epochMs)) {
    throw new RangeError(`Clock time must be a finite number: ${epochMs}`);
  }
}
