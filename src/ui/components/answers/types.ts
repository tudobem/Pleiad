import type { Question } from '../../../core/content/types.ts';
import type { Grade } from '../../../core/session/grading.ts';
import type { AnswerRecord } from '../../../core/session/reducer.ts';
import type { Response } from '../../../core/session/response.ts';

export interface AnswerProps<Q extends Question = Question> {
  readonly question: Q;
  readonly layout: readonly number[];
  /** Current response (question phase) or the given answer's response (feedback). */
  readonly response: Response;
  readonly feedback: boolean;
  readonly pending: AnswerRecord | undefined;
  readonly grade: Grade | undefined;
  onRespond(response: Response): void;
  /** Submit from the keyboard (short answers). */
  onSubmit(): void;
  onOverride(correct: boolean): void;
}
