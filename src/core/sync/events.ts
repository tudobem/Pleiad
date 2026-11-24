import type { Clock } from '../clock.ts';
import type { IdGenerator } from '../ids.ts';
import type { Confidence, Rating, ReviewEvent, ReviewMode } from './reviewEvent.ts';

export interface EventContext {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly profileId: string;
  readonly deviceId: string;
  readonly appVersion: string;
}

export interface ReviewInput {
  readonly cardId: string;
  readonly mode: ReviewMode;
  readonly type: string;
  readonly correct: boolean;
  readonly rating: Rating;
  readonly responseMs: number;
  readonly confidence?: Confidence;
  readonly schedulerStateBefore?: unknown;
  readonly schedulerStateAfter?: unknown;
  /** When the answer was given; defaults to now. */
  readonly ts?: number;
}

/** Build one append-only review event (SPEC 14.4). */
export function createReviewEvent(ctx: EventContext, input: ReviewInput): ReviewEvent {
  return {
    eventId: ctx.ids.newId(),
    profileId: ctx.profileId,
    deviceId: ctx.deviceId,
    cardId: input.cardId,
    ts: input.ts ?? ctx.clock.now(),
    mode: input.mode,
    type: input.type,
    correct: input.correct,
    rating: input.rating,
    responseMs: Math.max(0, Math.round(input.responseMs)),
    ...(input.confidence ? { confidence: input.confidence } : {}),
    schedulerStateBefore: input.schedulerStateBefore ?? null,
    schedulerStateAfter: input.schedulerStateAfter ?? null,
    appVersion: ctx.appVersion,
  };
}
