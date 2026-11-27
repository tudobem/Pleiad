import { weekOf } from '../gamification/goal.ts';
import { learningDay } from '../scheduler/day.ts';
import type { Confidence, ReviewEvent } from '../sync/reviewEvent.ts';

/** Stated probability of being right for each confidence level (SPEC 9). */
export const CONFIDENCE_P: Readonly<Record<Confidence, number>> = {
  guess: 0.35,
  fairly_sure: 0.7,
  certain: 0.95,
};
export const CONFIDENCE_LEVELS: readonly Confidence[] = ['guess', 'fairly_sure', 'certain'];
/** Below this many answers with confidence, metrics are not shown. */
export const MIN_CALIBRATION_ANSWERS = 10;
/** Bias within this margin counts as well calibrated. */
export const CALIBRATED_MARGIN = 0.05;
/** A calibrated week needs at least this many answers with confidence. */
export const CALIBRATED_WEEK_ANSWERS = 30;

export type Verdict = 'overconfident' | 'underconfident' | 'calibrated';

export interface CalibrationRow {
  readonly key: string;
  readonly count: number;
  /** Share answered correctly, 0..1. */
  readonly correct: number;
  /** Mean stated probability, 0..1. */
  readonly expected: number;
}

export interface Calibration {
  /** Answers that carry a confidence. */
  readonly answered: number;
  /** Mean squared error of the stated probability; lower is better. */
  readonly brier: number | null;
  /** Mean stated probability minus share correct; positive means overconfident. */
  readonly bias: number | null;
  readonly verdict: Verdict | null;
  /** The calibration curve: one row per confidence level. */
  readonly levels: readonly CalibrationRow[];
  readonly bySubject: readonly CalibrationRow[];
  readonly byTier: readonly CalibrationRow[];
}

const rated = (events: readonly ReviewEvent[]) =>
  events.filter((e): e is ReviewEvent & { confidence: Confidence } => e.confidence !== undefined);

function row(
  key: string,
  events: readonly (ReviewEvent & { confidence: Confidence })[],
): CalibrationRow {
  const count = events.length;
  const correct = count === 0 ? 0 : events.filter((e) => e.correct).length / count;
  const expected =
    count === 0 ? 0 : events.reduce((sum, e) => sum + CONFIDENCE_P[e.confidence], 0) / count;
  return { key, count, correct, expected };
}

export function verdictFor(bias: number): Verdict {
  if (bias > CALIBRATED_MARGIN) return 'overconfident';
  if (bias < -CALIBRATED_MARGIN) return 'underconfident';
  return 'calibrated';
}

function groupRows(
  events: readonly (ReviewEvent & { confidence: Confidence })[],
  keyOf: (e: ReviewEvent) => string | undefined,
): CalibrationRow[] {
  const groups = new Map<string, (ReviewEvent & { confidence: Confidence })[]>();
  for (const e of events) {
    const key = keyOf(e);
    if (key === undefined) continue;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups]
    .map(([key, list]) => row(key, list))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
}

/**
 * Confidence calibration from the review log (SPEC 9): Brier score, bias and
 * the calibration curve, overall and by subject and tier.
 */
export function calibration(
  events: readonly ReviewEvent[],
  ctx: {
    readonly subjectOf: (cardId: string) => string | undefined;
    readonly tierOf: (cardId: string) => string | undefined;
  },
): Calibration {
  const withConfidence = rated(events);
  const answered = withConfidence.length;
  if (answered === 0) {
    return {
      answered,
      brier: null,
      bias: null,
      verdict: null,
      levels: [],
      bySubject: [],
      byTier: [],
    };
  }
  const brier =
    withConfidence.reduce(
      (sum, e) => sum + (CONFIDENCE_P[e.confidence] - (e.correct ? 1 : 0)) ** 2,
      0,
    ) / answered;
  const overall = row('all', withConfidence);
  const bias = overall.expected - overall.correct;
  return {
    answered,
    brier,
    bias,
    verdict: verdictFor(bias),
    levels: CONFIDENCE_LEVELS.map((level) =>
      row(
        level,
        withConfidence.filter((e) => e.confidence === level),
      ),
    ),
    bySubject: groupRows(withConfidence, (e) => ctx.subjectOf(e.cardId)),
    byTier: groupRows(withConfidence, (e) => ctx.tierOf(e.cardId)),
  };
}

/** Weeks with enough answers with confidence and a bias within the margin. */
export function calibratedWeeks(events: readonly ReviewEvent[], offsetMinutes: number): number[] {
  const byWeek = new Map<number, (ReviewEvent & { confidence: Confidence })[]>();
  for (const e of rated(events)) {
    const w = weekOf(learningDay(e.ts, offsetMinutes));
    byWeek.set(w, [...(byWeek.get(w) ?? []), e]);
  }
  return [...byWeek]
    .filter(([, list]) => {
      if (list.length < CALIBRATED_WEEK_ANSWERS) return false;
      const r = row('week', list);
      return Math.abs(r.expected - r.correct) <= CALIBRATED_MARGIN;
    })
    .map(([w]) => w)
    .sort((a, b) => a - b);
}
