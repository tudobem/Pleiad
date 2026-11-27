import { describe, expect, it } from 'vitest';
import { previewDue, reviewForAnswer, subjectFor, type AnswerContext } from './commit.ts';
import { mcq, recall } from '../content/fixtures.test-util.ts';
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
  response: { type: 'mcq', choice: 0 },
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

describe('recall ratings', () => {
  it('logs the self-rating and previews each rating button', () => {
    const q = recall({ status: 'verified', verified_on: '2026-01-02' });
    const a = answer({
      questionId: q.id,
      response: { type: 'recall' },
      selfRating: 'hard',
      correct: true,
    });
    expect(reviewForAnswer(events, ctx({ question: q, answer: a })).event.rating).toBe('hard');
    const base = ctx({
      question: q,
      answer: answer({ questionId: q.id, response: { type: 'recall' } }),
    });
    const again = previewDue(base, { rating: 'again' }) ?? 0;
    const easy = previewDue(base, { rating: 'easy' }) ?? 0;
    expect(easy).toBeGreaterThan(again);
  });
});

describe('previewDue', () => {
  it('matches the committed due date and is null for practice', () => {
    expect(previewDue(ctx())).toBe(reviewForAnswer(events, ctx()).card.scheduler?.due);
    expect(previewDue(ctx({ mode: 'extra' }))).toBeNull();
  });
});

describe('answers whose question is no longer served', () => {
  it('uses the answer record when there is no live question', () => {
    const a = answer({ questionId: 'retired-1', response: { type: 'short', text: 'x' } });
    expect(subjectFor(a, undefined)).toEqual({ id: 'retired-1', type: 'short' });
    expect(subjectFor(a, question)).toBe(question);
  });

  it('logs the review from the id and type alone, skipping the slow rule', () => {
    const subject = { id: 'retired-1', type: 'mcq' as const };
    // A tier threshold would make this slow (Hard) if the tier were known.
    const withTier = reviewForAnswer(events, ctx({ thresholds: { foundational: 1000 } }));
    expect(withTier.event.rating).toBe('hard');
    const { event, card } = reviewForAnswer(
      events,
      ctx({ question: subject, thresholds: { foundational: 1000 } }),
    );
    expect(event).toMatchObject({
      cardId: 'retired-1',
      type: 'mcq',
      mode: 'scheduled',
      rating: 'good',
    });
    expect(card.scheduler).toEqual(event.schedulerStateAfter);
    expect(replayCards([event], scheduler).get('retired-1')).toEqual(card);
  });
});

describe('confidence in reviews (SPEC 9)', () => {
  it('rates a correct guess Hard and logs the confidence', () => {
    const { event } = reviewForAnswer(events, ctx({ answer: answer({ confidence: 'guess' }) }));
    expect(event.rating).toBe('hard');
    expect(event.confidence).toBe('guess');
  });

  it('never changes the rating for Fairly sure or Certain', () => {
    for (const confidence of ['fairly_sure', 'certain'] as const) {
      expect(reviewForAnswer(events, ctx({ answer: answer({ confidence }) })).event.rating).toBe(
        'good',
      );
      expect(
        reviewForAnswer(events, ctx({ answer: answer({ confidence, correct: false }) })).event
          .rating,
      ).toBe('again');
    }
    expect(reviewForAnswer(events, ctx()).event).not.toHaveProperty('confidence');
  });
});
