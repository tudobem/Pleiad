import type { Rating } from '../sync/reviewEvent.ts';

export interface RatingInput {
  readonly correct: boolean;
  /** The user marked the answer as a guess (confidence chips, M10). */
  readonly guess?: boolean;
  /** Much slower than usual for the tier (M3 sets the threshold). */
  readonly slow?: boolean;
  /** The user pressed "Too easy" on the feedback screen. */
  readonly tooEasy?: boolean;
}

/**
 * Answer-to-rating mapping for auto-graded types (SPEC 7.3):
 * wrong = Again; right = Good; right but guess or slow = Hard;
 * Easy only via an explicit "Too easy".
 */
export function ratingFor(input: RatingInput): Rating {
  if (!input.correct) return 'again';
  if (input.tooEasy) return 'easy';
  if (input.guess || input.slow) return 'hard';
  return 'good';
}
