/**
 * Learning days (SPEC 7.1): a day runs from 04:00 to 04:00 local time, so a
 * late-night session still counts for the evening it started in. Stored times
 * are UTC; the local offset is applied only here.
 */
export const DAY_MS = 86_400_000;
export const DAY_BOUNDARY_HOUR = 4;
const BOUNDARY_MS = DAY_BOUNDARY_HOUR * 3_600_000;

/** Whole learning days since the epoch for a UTC moment and local offset. */
export function learningDay(atMs: number, offsetMinutes: number): number {
  return Math.floor((atMs + offsetMinutes * 60_000 - BOUNDARY_MS) / DAY_MS);
}

/** UTC moment when the given learning day starts (04:00 local). */
export function dayStartMs(day: number, offsetMinutes: number): number {
  return day * DAY_MS + BOUNDARY_MS - offsetMinutes * 60_000;
}

/** UTC moment when the learning day containing `atMs` ends. */
export function nextDayStartMs(atMs: number, offsetMinutes: number): number {
  return dayStartMs(learningDay(atMs, offsetMinutes) + 1, offsetMinutes);
}

/** Days between two moments counted in learning days (0 = same day). */
export function daysBetween(fromMs: number, toMs: number, offsetMinutes: number): number {
  return learningDay(toMs, offsetMinutes) - learningDay(fromMs, offsetMinutes);
}
