import { magnitude } from '../core/content/estimation.ts';
import type { DatePrecision } from '../core/content/types.ts';
import type { TimelineDate } from '../core/content/timeline.ts';
import { t, type StringId } from './strings.ts';

const THOUSANDS: readonly StringId[] = [
  'number.units',
  'number.thousand',
  'number.million',
  'number.billion',
  'number.trillion',
];

/** "86 billion", "1.23 million", "86,000", "1974" (no grouping below 10,000). */
export function formatNumber(x: number): string {
  const { mantissa, thousands } = magnitude(x);
  const digits = mantissa.toLocaleString('en', {
    ...(thousands === 0 ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 3 }),
    useGrouping: Math.abs(mantissa) >= 10_000,
  });
  return thousands === 0 ? digits : t(THOUSANDS[thousands] ?? 'number.units', { n: digits });
}

/** A number with its unit: "86 billion neurons". */
export function withUnit(x: number, unit: string | undefined): string {
  return unit ? t('estimate.withUnit', { n: formatNumber(x), unit }) : formatNumber(x);
}

/** "1974", "350 BCE", "March 1995", "17 March 1995". */
export function formatTimelineDate(d: TimelineDate, precision: DatePrecision = 'year'): string {
  const year = d.year < 0 ? t('date.bce', { year: -d.year }) : String(d.year);
  if (precision === 'year' || d.month === undefined) return year;
  const month = new Date(Date.UTC(2000, d.month - 1, 1)).toLocaleString('en', {
    month: 'long',
    timeZone: 'UTC',
  });
  return precision === 'month' || d.day === undefined
    ? t('date.month', { month, year })
    : t('date.day', { day: d.day, month, year });
}
