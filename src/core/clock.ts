/**
 * All time in core comes through a Clock. Never call Date.now() in src/core.
 * Values are UTC epoch milliseconds. The local UTC offset is asked for
 * separately and only used to decide which learning day a moment belongs to,
 * so stored times never depend on the time zone.
 */
export interface Clock {
  now(): number;
  /** Local offset from UTC in minutes at the given moment (e.g. +60 for CET). */
  utcOffsetMinutes(atMs: number): number;
}

/** A clock frozen at one instant. For tests and deterministic replay. */
export function fixedClock(epochMs: number, offsetMinutes = 0): Clock {
  assertFiniteTime(epochMs);
  return { now: () => epochMs, utcOffsetMinutes: () => offsetMinutes };
}

/** A manually advanced clock for tests that simulate elapsed time. */
export interface ManualClock extends Clock {
  set(epochMs: number): void;
  advance(ms: number): void;
  setOffset(minutes: number): void;
}

export function manualClock(startEpochMs: number, offsetMinutes = 0): ManualClock {
  assertFiniteTime(startEpochMs);
  let current = startEpochMs;
  let offset = offsetMinutes;
  return {
    now: () => current,
    utcOffsetMinutes: () => offset,
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
    setOffset(minutes) {
      offset = minutes;
    },
  };
}

function assertFiniteTime(epochMs: number): void {
  if (!Number.isFinite(epochMs)) {
    throw new RangeError(`Clock time must be a finite number: ${epochMs}`);
  }
}
