import type { Question } from '../content/types.ts';
import { clozeAnswers } from '../content/cloze.ts';
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
