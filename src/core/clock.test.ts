import { describe, expect, it } from 'vitest';
import { fixedClock, manualClock } from './clock.ts';

const T0 = Date.UTC(2026, 10, 23, 4, 0, 0);

describe('fixedClock', () => {
  it('always returns the same instant', () => {
    const clock = fixedClock(T0);
    expect(clock.now()).toBe(T0);
    expect(clock.now()).toBe(T0);
  });

  it('rejects non-finite times', () => {
    expect(() => fixedClock(Number.NaN)).toThrow(RangeError);
  });
});

describe('manualClock', () => {
  it('advances and can be set', () => {
    const clock = manualClock(T0);
    clock.advance(1000);
    expect(clock.now()).toBe(T0 + 1000);
    clock.set(T0 - 5);
    expect(clock.now()).toBe(T0 - 5);
  });

  it('refuses to go backwards via advance', () => {
    const clock = manualClock(T0);
    expect(() => clock.advance(-1)).toThrow(RangeError);
    expect(() => clock.advance(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(clock.now()).toBe(T0);
  });
});
