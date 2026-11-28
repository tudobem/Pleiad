import type { Question } from '../content/types.ts';
import { clozeAnswers } from '../content/cloze.ts';

/**
 * What the user has entered for one question. Indices refer to display
 * positions in the item's `layout` (the shuffled order shown on screen).
 */
export type Response =
  | { readonly type: 'mcq'; readonly choice: number }
  | { readonly type: 'short'; readonly text: string }
  /** Per blank: the display index of the chip placed there, or null. */
  | { readonly type: 'cloze'; readonly fills: readonly (number | null)[] }
  /** Per left item (original order): display index of its paired right item, or null. */
  | { readonly type: 'match'; readonly pairs: readonly (number | null)[] }
  /** Display indices in the order the user tapped them. */
  | { readonly type: 'order'; readonly sequence: readonly number[] }
  /** Bins: the tapped bin index; slider: the chosen value. Null until chosen. */
  | { readonly type: 'estimation'; readonly bin: number | null; readonly value: number | null }
  /** Display indices in the order the user tapped them, like order. */
  | { readonly type: 'timeline'; readonly sequence: readonly number[] }
  /**
   * Image: `choice` (display index) in MCQ mode; `point` in hotspot mode, in
   * percent of the image, with the image's width/height ratio when tapped.
   */
  | {
      readonly type: 'image';
      readonly choice: number;
      readonly point: { readonly x: number; readonly y: number; readonly aspect: number } | null;
    }
  /** Display index of the chosen thinker. */
  | { readonly type: 'attribution'; readonly choice: number }
  | { readonly type: 'recall' };

/** The empty response a question starts with. */
export function emptyResponse(q: Question): Response {
  switch (q.type) {
    case 'mcq':
      return { type: 'mcq', choice: -1 };
    case 'short':
      return { type: 'short', text: '' };
    case 'cloze':
      return { type: 'cloze', fills: clozeAnswers(q.text).map(() => null) };
    case 'match':
      return { type: 'match', pairs: q.pairs.map(() => null) };
    case 'order':
      return { type: 'order', sequence: [] };
    case 'estimation':
      return { type: 'estimation', bin: null, value: null };
    case 'timeline':
      return { type: 'timeline', sequence: [] };
    case 'image':
      return { type: 'image', choice: -1, point: null };
    case 'attribution':
      return { type: 'attribution', choice: -1 };
    case 'recall':
      return { type: 'recall' };
  }
}

/** Whether the response is complete enough to check (Check button enabled). */
export function isComplete(q: Question, r: Response | null): boolean {
  if (!r || r.type !== q.type) return false;
  switch (r.type) {
    case 'mcq':
      return r.choice >= 0;
    case 'short':
      return r.text.trim().length > 0;
    case 'cloze':
      return r.fills.every((f) => f !== null);
    case 'match':
      return r.pairs.every((p) => p !== null);
    case 'order':
      return q.type === 'order' && r.sequence.length === q.items.length;
    case 'estimation':
      return r.bin !== null || r.value !== null;
    case 'timeline':
      return q.type === 'timeline' && r.sequence.length === q.events.length;
    case 'image':
      return r.choice >= 0 || r.point !== null;
    case 'attribution':
      return r.choice >= 0;
    case 'recall':
      return true;
  }
}

/** Chips offered for a cloze: the answers followed by the distractors. */
export function clozeChips(q: Extract<Question, { type: 'cloze' }>): string[] {
  return [...clozeAnswers(q.text), ...(q.bank ?? [])];
}
