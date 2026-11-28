import type { QuestionType } from '../content/types.ts';
import type { Confidence, Rating } from '../sync/reviewEvent.ts';

/** What a hardware key does in a session (SPEC 17). */
export type KeyCommand =
  | { readonly kind: 'select'; readonly index: number }
  | { readonly kind: 'check' }
  | { readonly kind: 'next' }
  | { readonly kind: 'rate'; readonly rating: Rating }
  | { readonly kind: 'confidence'; readonly confidence: Confidence };

export interface KeyContext {
  readonly phase: 'question' | 'feedback';
  readonly type: QuestionType;
  /** Options shown for an MCQ item, or bins for an estimation item. */
  readonly optionCount: number;
  readonly canCheck: boolean;
  /** A commit is in progress: ignore keys until it finishes. */
  readonly busy: boolean;
  /** Confidence chips are shown for this question (SPEC 9). */
  readonly asksConfidence?: boolean;
}

const CONFIDENCE_KEYS: Readonly<Record<string, Confidence>> = {
  q: 'guess',
  w: 'fairly_sure',
  e: 'certain',
};

const RATINGS: readonly Rating[] = ['again', 'hard', 'good', 'easy'];
const MAX_OPTIONS = 5;
const MAX_BINS = 6;

/**
 * Map a key (KeyboardEvent.key) to a session command: 1 to 5 choose an MCQ
 * option, Space or Enter check, reveal or continue, 1 to 4 rate a revealed
 * recall item; Q, W, E choose Guess, Fairly sure, Certain where asked.
 * Returns null when the key does nothing here.
 */
export function keyCommand(key: string, ctx: KeyContext): KeyCommand | null {
  if (ctx.busy) return null;
  const digit = /^[1-9]$/.test(key) ? Number(key) : 0;
  const confirm = key === ' ' || key === 'Enter';

  if (ctx.phase === 'question') {
    const confidence = CONFIDENCE_KEYS[key.toLowerCase()];
    if (confidence && ctx.asksConfidence) return { kind: 'confidence', confidence };
    const max = ctx.type === 'mcq' ? MAX_OPTIONS : ctx.type === 'estimation' ? MAX_BINS : 0;
    if (digit && digit <= Math.min(ctx.optionCount, max)) {
      return { kind: 'select', index: digit - 1 };
    }
    if (confirm && ctx.canCheck) return { kind: 'check' };
    return null;
  }

  if (ctx.type === 'recall') {
    const rating = digit ? RATINGS[digit - 1] : undefined;
    return rating ? { kind: 'rate', rating } : null;
  }
  return confirm ? { kind: 'next' } : null;
}
