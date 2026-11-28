import { describe, expect, it } from 'vitest';
import { mcq } from './fixtures.test-util.ts';
import {
  binOf,
  magnitude,
  offBy,
  roundSignificant,
  sliderPosition,
  sliderValue,
  withinTolerance,
} from './estimation.ts';
import { chronological, parseTimelineDate } from './timeline.ts';
import type { EstimationQuestion, TimelineQuestion } from './types.ts';

const base = mcq();
const est = (o: Partial<EstimationQuestion>): EstimationQuestion => ({
  ...base,
  type: 'estimation',
  value: 86e9,
  unit: 'neurons',
  scale: 'log',
  range: { min: 1e6, max: 1e12 },
  tolerance: 2,
  ...o,
});

describe('estimation', () => {
  it('rounds to significant digits', () => {
    expect(roundSignificant(86_123_456_789)).toBe(86_000_000_000);
    expect(roundSignificant(0.012345, 3)).toBe(0.0123);
    expect(roundSignificant(0)).toBe(0);
  });

  it('maps log and linear sliders both ways', () => {
    const log = { min: 1e6, max: 1e12 };
    expect(sliderValue(0, log, 'log')).toBe(1e6);
    expect(sliderValue(1000, log, 'log')).toBe(1e12);
    expect(sliderValue(500, log, 'log')).toBe(1e9);
    expect(sliderPosition(1e9, log, 'log')).toBe(500);
    const years = { min: 1900, max: 2000 };
    expect(sliderValue(745, years, 'linear')).toBe(1975);
    expect(sliderPosition(1975, years, 'linear')).toBe(750);
  });

  it('grades by factor on a log scale and by amount on a linear one', () => {
    const q = est({});
    expect(withinTolerance(q, 43e9)).toBe(true);
    expect(withinTolerance(q, 172e9)).toBe(true);
    expect(withinTolerance(q, 40e9)).toBe(false);
    const lin = est({
      scale: 'linear',
      value: 1974,
      range: { min: 1900, max: 2020 },
      tolerance: 3,
    });
    expect(withinTolerance(lin, 1977)).toBe(true);
    expect(withinTolerance(lin, 1978)).toBe(false);
  });

  it('finds the bin with a max-exclusive edge', () => {
    const bins = [
      { min: 0, max: 10 },
      { min: 10, max: 100 },
    ];
    expect(binOf(bins, 10)).toBe(1);
    expect(binOf(bins, 9.99)).toBe(0);
    expect(binOf(bins, 100)).toBe(-1);
  });

  it('says how far off a guess was', () => {
    expect(offBy(est({}), 10e9)).toEqual({ direction: 'low', amount: 8.6 });
    expect(offBy(est({}), 860e9)).toEqual({ direction: 'high', amount: 10 });
    const lin = est({ scale: 'linear', value: 1974 });
    expect(offBy(lin, 1986)).toEqual({ direction: 'high', amount: 12 });
    expect(offBy(lin, 1974)).toEqual({ direction: 'exact', amount: 0 });
  });

  it('splits numbers into thousands', () => {
    expect(magnitude(86e9)).toEqual({ mantissa: 86, thousands: 3 });
    expect(magnitude(1_234_567)).toEqual({ mantissa: 1.23, thousands: 2 });
    expect(magnitude(86_000)).toEqual({ mantissa: 86_000, thousands: 0 });
    expect(magnitude(1641)).toEqual({ mantissa: 1641, thousands: 0 });
  });
});

describe('timeline dates', () => {
  it('parses years, months, days and BCE', () => {
    expect(parseTimelineDate('1974')).toEqual({ year: 1974 });
    expect(parseTimelineDate('-0350')).toEqual({ year: -350 });
    expect(parseTimelineDate('1995-03-17')).toEqual({ year: 1995, month: 3, day: 17 });
    expect(parseTimelineDate('1995-13')).toBeNull();
    expect(parseTimelineDate('0')).toBeNull();
    expect(parseTimelineDate('soon')).toBeNull();
  });

  it('orders events by date', () => {
    const q: TimelineQuestion = {
      ...base,
      type: 'timeline',
      events: [
        { label: 'c', date: '1995' },
        { label: 'a', date: '-0350' },
        { label: 'b', date: '1641' },
      ],
    };
    expect(chronological(q)).toEqual([1, 2, 0]);
  });
});
