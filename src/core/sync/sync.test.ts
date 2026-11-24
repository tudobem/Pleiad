import { describe, expect, it } from 'vitest';
import { createReviewEvent } from './events.ts';
import { replayCards } from './replay.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { fixedClock } from '../clock.ts';
import { sequentialIds } from '../ids.ts';
import { seededRandom, shuffle } from '../random.ts';
import { reviewEvent } from '../storageContract.test-util.ts';

describe('createReviewEvent', () => {
  it('fills identity, time and version from the context', () => {
    const ctx = {
      clock: fixedClock(5000),
      ids: sequentialIds('ev'),
      profileId: 'p',
      deviceId: 'd',
      appVersion: '1.2.3',
    };
    const e = createReviewEvent(ctx, {
      cardId: 'q1',
      mode: 'extra',
      type: 'mcq',
      correct: false,
      rating: 'again',
      responseMs: 1234.6,
    });
    expect(e).toEqual({
      eventId: 'ev-1',
      profileId: 'p',
      deviceId: 'd',
      cardId: 'q1',
      ts: 5000,
      mode: 'extra',
      type: 'mcq',
      correct: false,
      rating: 'again',
      responseMs: 1235,
      schedulerStateBefore: null,
      schedulerStateAfter: null,
      appVersion: '1.2.3',
    });
    expect(createReviewEvent(ctx, { ...e, responseMs: 1 }).eventId).toBe('ev-2');
  });
});

describe('replayCards', () => {
  const scheduler = fsrsScheduler();
  const DAY = 86_400_000;
  const events = [
    reviewEvent({ eventId: 'e1', cardId: 'a', ts: 10 * DAY, mode: 'scheduled', rating: 'good' }),
    reviewEvent({
      eventId: 'e2',
      cardId: 'a',
      ts: 20 * DAY,
      mode: 'scheduled',
      rating: 'again',
      correct: false,
    }),
    reviewEvent({
      eventId: 'e3',
      cardId: 'a',
      ts: 21 * DAY,
      mode: 'extra',
      rating: 'again',
      correct: false,
    }),
    reviewEvent({ eventId: 'e4', cardId: 'b', ts: 15 * DAY, mode: 'extra', rating: 'good' }),
  ];

  it('derives card state, stepping FSRS only for scheduled reviews', () => {
    const cards = replayCards(events, scheduler);
    const a = cards.get('a');
    const expected = scheduler.review(scheduler.review(null, 'good', 10 * DAY), 'again', 20 * DAY);
    expect(a).toEqual({
      cardId: 'a',
      firstSeenTs: 10 * DAY,
      introducedTs: 10 * DAY,
      lastReviewTs: 21 * DAY,
      lastRating: 'again',
      scheduler: expected,
      attempts: 3,
      misses: 2,
    });
    expect(a?.scheduler?.lapses).toBe(1);
    // Extra practice never introduces a card or touches FSRS (SPEC 7.6).
    expect(cards.get('b')?.scheduler).toBeNull();
    expect(cards.get('b')?.introducedTs).toBeNull();
  });

  it('is independent of input order and counts duplicate events once', () => {
    const expected = replayCards(events, scheduler);
    for (const seed of [1, 2, 3]) {
      const shuffled = shuffle([...events, ...events], seededRandom(seed));
      expect(replayCards(shuffled, scheduler)).toEqual(expected);
    }
  });

  it('breaks timestamp ties by eventId', () => {
    const tied = [
      reviewEvent({ eventId: 'z', cardId: 'a', ts: 1, rating: 'hard' }),
      reviewEvent({ eventId: 'y', cardId: 'a', ts: 1, rating: 'easy' }),
    ];
    expect(replayCards(tied, scheduler).get('a')?.lastRating).toBe('hard');
    expect(replayCards([...tied].reverse(), scheduler).get('a')?.lastRating).toBe('hard');
  });
});
