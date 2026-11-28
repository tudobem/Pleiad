import type { EstimationQuestion } from './types.ts';

/** Slider positions run 0..SLIDER_STEPS (SPEC 6: log-scale slider). */
export const SLIDER_STEPS = 1000;

type Scale = EstimationQuestion['scale'];
interface Range {
  readonly min: number;
  readonly max: number;
}

/** Round to `digits` significant digits (0 stays 0). */
export function roundSignificant(x: number, digits = 2): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(digits));
}

/** Linear sliders move in round steps: about a hundredth of the range. */
export function linearStep(range: Range): number {
  const span = range.max - range.min;
  return span > 0 ? Math.pow(10, Math.floor(Math.log10(span / 100))) : 1;
}

/** The value at a slider position, rounded as it is shown. */
export function sliderValue(position: number, range: Range, scale: Scale): number {
  const t = Math.min(1, Math.max(0, position / SLIDER_STEPS));
  if (scale === 'log') {
    return roundSignificant(range.min * Math.pow(range.max / range.min, t));
  }
  const step = linearStep(range);
  const raw = range.min + (range.max - range.min) * t;
  return Number((Math.round(raw / step) * step).toFixed(10));
}

/** The slider position closest to a value. */
export function sliderPosition(value: number, range: Range, scale: Scale): number {
  const t =
    scale === 'log'
      ? Math.log(value / range.min) / Math.log(range.max / range.min)
      : (value - range.min) / (range.max - range.min);
  return Math.round(Math.min(1, Math.max(0, t)) * SLIDER_STEPS);
}

/** Whether a slider answer is close enough (log: within a factor; linear: an amount). */
export function withinTolerance(q: EstimationQuestion, guess: number): boolean {
  const tol = q.tolerance ?? 0;
  if (q.scale === 'log') {
    const f = Math.max(1, tol);
    return guess >= q.value / f - 1e-9 * q.value && guess <= q.value * f * (1 + 1e-9);
  }
  return Math.abs(guess - q.value) <= tol + 1e-9;
}

/** Index of the bin containing a value (max exclusive), or -1. */
export function binOf(bins: readonly Range[], value: number): number {
  return bins.findIndex((b) => value >= b.min && value < b.max);
}

/** How far off a guess was: a factor on a log scale, an amount on a linear one. */
export interface OffBy {
  readonly direction: 'low' | 'high' | 'exact';
  /** Log scale: how many times too low or high (>= 1). Linear: absolute difference. */
  readonly amount: number;
}

export function offBy(q: EstimationQuestion, guess: number): OffBy {
  if (guess === q.value) return { direction: 'exact', amount: 0 };
  const direction = guess < q.value ? 'low' : 'high';
  if (q.scale === 'log') {
    const factor = guess < q.value ? q.value / guess : guess / q.value;
    return { direction, amount: roundSignificant(factor) };
  }
  return { direction, amount: roundSignificant(Math.abs(guess - q.value), 3) };
}

/** A number split for display as "86 billion": mantissa and power of a thousand. */
export interface Magnitude {
  readonly mantissa: number;
  /** 0 (units), 1 thousand, 2 million, 3 billion, 4 trillion. */
  readonly thousands: number;
}

export function magnitude(x: number): Magnitude {
  const abs = Math.abs(x);
  let thousands = 0;
  // Below a million, plain digits read better ("86,000").
  if (abs >= 1e6) thousands = Math.min(4, Math.floor(Math.log10(abs) / 3));
  // Plain numbers (years, small counts) keep every digit.
  const mantissa = thousands === 0 ? x : roundSignificant(x / Math.pow(1000, thousands), 3);
  return { mantissa, thousands };
}
