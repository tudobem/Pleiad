import type { QuestionType } from '../content/types.ts';
import type { Rating } from '../sync/reviewEvent.ts';

/** What a hardware key does in a session (SPEC 17). */
export type KeyCommand =
  | { readonly kind: 'select'; readonly index: number }
  | { readonly kind: 'check' }
  | { readonly kind: 'next' }
  | { readonly kind: 'rate'; readonly rating: Rating };

export interface KeyContext {
  readonly phase: 'question' | 'feedback';
  readonly type: QuestionType;
  /** Options shown for an MCQ item. */
  readonly optionCount: number;
  readonly canCheck: boolean;
  /** A commit is in progress: ignore keys until it finishes. */
  readonly busy: boolean;
}

const RATINGS: readonly Rating[] = ['again', 'hard', 'good', 'easy'];
const MAX_OPTIONS = 5;

/**
 * Map a key (KeyboardEvent.key) to a session command: 1 to 5 choose an MCQ
 * option, Space or Enter check, reveal or continue, 1 to 4 rate a revealed
 * recall item. Returns null when the key does nothing here.
 */
export function keyCommand(key: string, ctx: KeyContext): KeyCommand | null {
  if (ctx.busy) return null;
  const digit = /^[1-9]$/.test(key) ? Number(key) : 0;
  const confirm = key === ' ' || key === 'Enter';

  if (ctx.phase === 'question') {
    if (digit && ctx.type === 'mcq' && digit <= Math.min(ctx.optionCount, MAX_OPTIONS)) {
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
