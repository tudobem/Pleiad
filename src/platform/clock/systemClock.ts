import type { Clock } from '../../core/clock.ts';

/** The only place in the app that reads the wall clock and time zone. */
export const systemClock: Clock = {
  now: () => Date.now(),
  utcOffsetMinutes: (atMs) => -new Date(atMs).getTimezoneOffset(),
};
