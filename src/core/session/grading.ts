import type { Hotspot, Question } from '../content/types.ts';
import { clozeAnswers } from '../content/cloze.ts';
import { binOf, withinTolerance } from '../content/estimation.ts';
import { chronological } from '../content/timeline.ts';
import { normalizeText } from '../content/normalize.ts';
import { answersMatch, parseNumber } from './normalizeAnswer.ts';
import { clozeChips, type Response } from './response.ts';

/**
 * Auto-grading per type (SPEC 6). `parts` marks each blank, pair or position
 * right or wrong for the feedback screen. Recall is never auto-graded: the
 * user's own rating decides.
 */
export interface Grade {
  readonly correct: boolean;
  readonly parts: readonly boolean[];
}

export function grade(q: Question, layout: readonly number[], r: Response): Grade {
  if (r.type !== q.type) throw new Error(`Response type ${r.type} does not match ${q.type}`);
  const at = (displayIndex: number | null): number | undefined =>
    displayIndex === null ? undefined : layout[displayIndex];

  switch (q.type) {
    case 'mcq': {
      const choice = (r as Extract<Response, { type: 'mcq' }>).choice;
      const correct = at(choice) === q.answer;
      return { correct, parts: [correct] };
    }
    case 'short': {
      const text = (r as Extract<Response, { type: 'short' }>).text;
      const correct = gradeShort(q, text);
      return { correct, parts: [correct] };
    }
    case 'cloze': {
      const fills = (r as Extract<Response, { type: 'cloze' }>).fills;
      const chips = clozeChips(q);
      const parts = clozeAnswers(q.text).map((answer, i) => {
        const chip = at(fills[i] ?? null);
        return chip !== undefined && normalizeText(chips[chip] ?? '') === normalizeText(answer);
      });
      return { correct: parts.every(Boolean), parts };
    }
    case 'match': {
      const pairs = (r as Extract<Response, { type: 'match' }>).pairs;
      const parts = q.pairs.map((_, i) => at(pairs[i] ?? null) === i);
      return { correct: parts.every(Boolean), parts };
    }
    case 'order': {
      const sequence = (r as Extract<Response, { type: 'order' }>).sequence;
      const parts = q.items.map((_, i) => at(sequence[i] ?? null) === i);
      return { correct: parts.every(Boolean), parts };
    }
    case 'estimation': {
      const { bin, value } = r as Extract<Response, { type: 'estimation' }>;
      const correct = q.bins
        ? bin !== null && binOf(q.bins, q.value) === bin
        : value !== null && withinTolerance(q, value);
      return { correct, parts: [correct] };
    }
    case 'timeline': {
      const sequence = (r as Extract<Response, { type: 'timeline' }>).sequence;
      const right = chronological(q);
      const parts = right.map((event, i) => at(sequence[i] ?? null) === event);
      return { correct: parts.every(Boolean), parts };
    }
    case 'image': {
      const { choice, point } = r as Extract<Response, { type: 'image' }>;
      const correct =
        q.mode === 'mcq'
          ? at(choice) === q.answer
          : point !== null && inHotspot(q.hotspots[q.answer], point);
      return { correct, parts: [correct] };
    }
    case 'attribution': {
      // Display index into [answer, ...options] shuffled; original 0 is the answer.
      const choice = (r as Extract<Response, { type: 'attribution' }>).choice;
      const correct = at(choice) === 0;
      return { correct, parts: [correct] };
    }
    case 'recall':
      return { correct: false, parts: [] };
  }
}

export function gradeShort(q: Extract<Question, { type: 'short' }>, text: string): boolean {
  if (q.numeric) {
    const n = parseNumber(text);
    if (n !== null && Math.abs(n - q.numeric.value) <= q.numeric.tolerance) return true;
  }
  return q.answers.some((a) => answersMatch(text, a));
}

/**
 * Whether a tap lies inside a hotspot. Coordinates are percent of the image;
 * y is scaled by the image's height/width so the circle stays round.
 */
export function inHotspot(
  h: Hotspot | undefined,
  p: { readonly x: number; readonly y: number; readonly aspect: number },
): boolean {
  if (!h) return false;
  const dx = p.x - h.x;
  const dy = (p.y - h.y) / (p.aspect > 0 ? p.aspect : 1);
  return Math.hypot(dx, dy) <= h.r;
}
