import type { Question, Tier } from '../content/types.ts';
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

/**
 * What logging an answer needs to know about its question. A full Question
 * qualifies, but so does just an ID and type: an answer given just before its
 * question was retired must still be logged (the log is append-only and the
 * source of truth), even though the question is no longer served.
 */
export interface AnswerSubject {
  readonly id: string;
  readonly type: Question['type'];
  /** Unknown for questions no longer served; the slow-answer rule is then skipped. */
  readonly tier?: Tier;
}

/** The subject of an answer: the live question if there is one, else what the answer records. */
export function subjectFor(answer: AnswerRecord, question: Question | undefined): AnswerSubject {
  return question ?? { id: answer.questionId, type: answer.response.type };
}

export interface AnswerContext {
  readonly question: AnswerSubject;
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
    slow: question.tier !== undefined && isSlow(thresholds, question.tier, answer.responseMs),
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
