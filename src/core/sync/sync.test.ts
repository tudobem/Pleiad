import { describe, expect, it } from 'vitest';
import { createReviewEvent } from './events.ts';
import { replayCards } from './replay.ts';
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
  const events = [
    reviewEvent({ eventId: 'e1', cardId: 'a', ts: 10, mode: 'scheduled', rating: 'good' }),
    reviewEvent({
      eventId: 'e2',
      cardId: 'a',
      ts: 20,
      mode: 'scheduled',
      rating: 'again',
      correct: false,
    }),
    reviewEvent({
      eventId: 'e3',
      cardId: 'a',
      ts: 30,
      mode: 'extra',
      rating: 'again',
      correct: false,
    }),
    reviewEvent({ eventId: 'e4', cardId: 'b', ts: 15, mode: 'extra', rating: 'good' }),
  ];

  it('derives card state from the log', () => {
    const cards = replayCards(events);
    expect(cards.get('a')).toEqual({
      cardId: 'a',
      introducedTs: 10,
      lastReviewTs: 30,
      lastRating: 'again',
      reps: 2,
      lapses: 1,
      attempts: 3,
      misses: 2,
    });
    expect(cards.get('b')?.reps).toBe(0);
    expect(cards.get('b')?.attempts).toBe(1);
  });

  it('is independent of input order and counts duplicate events once', () => {
    const expected = replayCards(events);
    for (const seed of [1, 2, 3]) {
      const shuffled = shuffle([...events, ...events], seededRandom(seed));
      expect(replayCards(shuffled)).toEqual(expected);
    }
  });

  it('breaks timestamp ties by eventId', () => {
    const tied = [
      reviewEvent({ eventId: 'z', cardId: 'a', ts: 1, rating: 'hard' }),
      reviewEvent({ eventId: 'y', cardId: 'a', ts: 1, rating: 'easy' }),
    ];
    expect(replayCards(tied).get('a')?.lastRating).toBe('hard');
    expect(replayCards([...tied].reverse()).get('a')?.lastRating).toBe('hard');
  });
});
