import type { Question } from '../content/types.ts';
import type { Scheduler } from '../scheduler/scheduler.ts';
import { createReviewEvent, type EventContext } from '../sync/events.ts';
import { applyEvent, type CardState } from '../sync/replay.ts';
import type { Rating, ReviewEvent } from '../sync/reviewEvent.ts';
import { ratingFor } from './rating.ts';
import {
  finalizeAnswer,
  type AnswerRecord,
  type LeaveOptions,
  type SessionMode,
} from './reducer.ts';
import { isSlow, type SlowThresholds } from './slow.ts';

export interface AnswerContext {
  readonly question: Question;
  readonly answer: AnswerRecord;
  readonly mode: SessionMode;
  readonly card: CardState | undefined;
  readonly scheduler: Scheduler;
  readonly thresholds: SlowThresholds;
}

/**
 * SPEC 7.3 rating for an answer: recall uses the user's own rating; the other
 * types are auto-graded (after any override) with the slow and Too easy rules.
 */
export function answerRating(ctx: AnswerContext): Rating {
  const { answer, question, thresholds } = ctx;
  if (question.type === 'recall') return answer.selfRating ?? (answer.correct ? 'good' : 'again');
  return ratingFor({
    correct: answer.correct,
    slow: isSlow(thresholds, question.tier, answer.responseMs),
    tooEasy: answer.tooEasy,
  });
}

/**
 * The review event for a finished answer and the card state after it.
 * Scheduled answers step FSRS; extra practice leaves it unchanged (SPEC 7.6).
 */
export function reviewForAnswer(
  events: EventContext,
  ctx: AnswerContext,
): { event: ReviewEvent; card: CardState } {
  const rating = answerRating(ctx);
  const before = ctx.card?.scheduler ?? null;
  const scheduled = ctx.mode === 'scheduled';
  const event = createReviewEvent(events, {
    cardId: ctx.question.id,
    mode: ctx.mode,
    type: ctx.question.type,
    correct: ctx.answer.correct,
    rating,
    responseMs: ctx.answer.responseMs,
    ts: ctx.answer.answeredAt,
    ...(scheduled
      ? {
          schedulerStateBefore: before,
          schedulerStateAfter: ctx.scheduler.review(before, rating, ctx.answer.answeredAt),
        }
      : {}),
  });
  return { event, card: applyEvent(ctx.card, event, ctx.scheduler) };
}

/**
 * When the card would next be due if the user leaves feedback with these
 * options (e.g. a recall rating button); null for extra practice.
 */
export function previewDue(ctx: AnswerContext, options: LeaveOptions = {}): number | null {
  if (ctx.mode !== 'scheduled') return null;
  const answer = finalizeAnswer(ctx.answer, options);
  return ctx.scheduler.review(
    ctx.card?.scheduler ?? null,
    answerRating({ ...ctx, answer }),
    answer.answeredAt,
  ).due;
}
