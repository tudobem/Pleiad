import type { Clock } from '../../core/clock.ts';

/** The only place in the app that reads the wall clock. */
export const systemClock: Clock = {
  now: () => Date.now(),
};
