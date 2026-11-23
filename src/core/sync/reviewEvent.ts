/**
 * Review log event (SPEC 14.4). The log is append-only and is the source of
 * truth: card state must be reproducible by replaying it (SPEC 3.3, 19).
 * Provisional in M0; fields are finalized with the scheduler in M2/M3.
 */
export type ReviewMode = 'scheduled' | 'extra';
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type Confidence = 'guess' | 'fairly_sure' | 'certain';

export interface ReviewEvent {
  /** Globally unique (UUID or ULID); merge key for import and sync. */
  readonly eventId: string;
  readonly profileId: string;
  readonly deviceId: string;
  readonly cardId: string;
  /** UTC epoch milliseconds from the injected Clock. */
  readonly ts: number;
  readonly mode: ReviewMode;
  /** Question type, e.g. "mcq". */
  readonly type: string;
  readonly correct: boolean;
  readonly rating: Rating;
  readonly responseMs: number;
  readonly confidence?: Confidence;
  readonly schedulerStateBefore: unknown;
  readonly schedulerStateAfter: unknown;
  readonly appVersion: string;
}
