import type { DatePrecision, TimelineQuestion } from './types.ts';

/** A parsed timeline date; year is negative for BCE. */
export interface TimelineDate {
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
}

const DATE = /^(-?)(\d{1,4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export function parseTimelineDate(text: string): TimelineDate | null {
  const m = DATE.exec(text);
  if (!m) return null;
  const year = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  const month = m[3] === undefined ? undefined : Number(m[3]);
  const day = m[4] === undefined ? undefined : Number(m[4]);
  if (year === 0) return null; // There is no year 0 in BCE/CE dating.
  if (month !== undefined && (month < 1 || month > 12)) return null;
  if (day !== undefined && (day < 1 || day > 31)) return null;
  return { year, ...(month !== undefined ? { month } : {}), ...(day !== undefined ? { day } : {}) };
}

export function precisionOf(d: TimelineDate): DatePrecision {
  return d.day !== undefined ? 'day' : d.month !== undefined ? 'month' : 'year';
}

/** Sort key: earlier dates are smaller. */
export function dateKey(d: TimelineDate): number {
  return d.year * 10_000 + (d.month ?? 0) * 100 + (d.day ?? 0);
}

/** Event indices in chronological order (the correct answer). */
export function chronological(q: TimelineQuestion): number[] {
  const keys = q.events.map((e) => {
    const d = parseTimelineDate(e.date);
    return d ? dateKey(d) : 0;
  });
  return q.events.map((_, i) => i).sort((a, b) => (keys[a] ?? 0) - (keys[b] ?? 0));
}
