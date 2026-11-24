import { describe, expect, it } from 'vitest';
import { isSlow, slowThresholds } from './slow.ts';
import { reviewEvent } from '../storageContract.test-util.ts';

const events = (n: number, ms: number, mode: 'scheduled' | 'extra' = 'scheduled') =>
  Array.from({ length: n }, (_, i) =>
    reviewEvent({ eventId: `${mode}${ms}-${i}`, cardId: 'c', mode, responseMs: ms }),
  );

describe('slow answers (SPEC 7.3)', () => {
  it('uses 3x the median once there are enough samples', () => {
    const t = slowThresholds(events(10, 2000), () => 'foundational');
    expect(t.foundational).toBe(6000);
    expect(isSlow(t, 'foundational', 6001)).toBe(true);
    expect(isSlow(t, 'foundational', 6000)).toBe(false);
    expect(isSlow(t, 'advanced', 60_000)).toBe(false);
  });

  it('ignores extra practice and small samples', () => {
    expect(slowThresholds(events(9, 2000), () => 'foundational')).toEqual({});
    expect(slowThresholds(events(20, 2000, 'extra'), () => 'foundational')).toEqual({});
  });
});
