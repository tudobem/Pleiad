import { describe, expect, it } from 'vitest';
import { previewDue, reviewForAnswer, type AnswerContext } from './commit.ts';
import { mcq } from '../content/fixtures.test-util.ts';
import { fixedClock } from '../clock.ts';
import { sequentialIds } from '../ids.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { replayCards } from '../sync/replay.ts';
import type { AnswerRecord } from './reducer.ts';

const scheduler = fsrsScheduler();
const T = Date.UTC(2026, 10, 24, 12);
const events = {
  clock: fixedClock(T + 5000),
  ids: sequentialIds('ev'),
  profileId: 'p',
  deviceId: 'd',
  appVersion: '1',
};
const question = mcq({ status: 'verified', verified_on: '2026-01-02' });
const answer = (o: Partial<AnswerRecord> = {}): AnswerRecord => ({
  questionId: question.id,
  chosenDisplayIndex: 0,
  correct: true,
  responseMs: 3000,
  answeredAt: T,
  tooEasy: false,
  ...o,
});
const ctx = (o: Partial<AnswerContext> = {}): AnswerContext => ({
  question,
  answer: answer(),
  mode: 'scheduled',
  card: undefined,
  scheduler,
  thresholds: {},
  ...o,
});

describe('reviewForAnswer', () => {
  it('writes a scheduled event at answer time with scheduler states', () => {
    const { event, card } = reviewForAnswer(events, ctx());
    expect(event.ts).toBe(T);
    expect(event.mode).toBe('scheduled');
    expect(event.rating).toBe('good');
    expect(event.schedulerStateBefore).toBeNull();
    expect(event.schedulerStateAfter).toEqual(scheduler.review(null, 'good', T));
    expect(card.scheduler).toEqual(event.schedulerStateAfter);
    // The live result equals what replay derives from the log.
    expect(replayCards([event], scheduler).get(question.id)).toEqual(card);
  });

  it('applies Too easy, slow and wrong ratings', () => {
    expect(reviewForAnswer(events, ctx({ answer: answer({ tooEasy: true }) })).event.rating).toBe(
      'easy',
    );
    expect(reviewForAnswer(events, ctx({ thresholds: { foundational: 2000 } })).event.rating).toBe(
      'hard',
    );
    expect(reviewForAnswer(events, ctx({ answer: answer({ correct: false }) })).event.rating).toBe(
      'again',
    );
  });

  it('leaves FSRS untouched for extra practice', () => {
    const prior = reviewForAnswer(events, ctx()).card;
    const { event, card } = reviewForAnswer(events, ctx({ mode: 'extra', card: prior }));
    expect(event.mode).toBe('extra');
    expect(event.schedulerStateAfter).toBeNull();
    expect(card.scheduler).toEqual(prior.scheduler);
    expect(card.attempts).toBe(2);
  });
});

describe('previewDue', () => {
  it('matches the committed due date and is null for practice', () => {
    expect(previewDue(ctx())).toBe(reviewForAnswer(events, ctx()).card.scheduler?.due);
    expect(previewDue(ctx({ mode: 'extra' }))).toBeNull();
  });
});
