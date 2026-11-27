import { describe, expect, it } from 'vitest';
import { mcq, recall } from '../content/fixtures.test-util.ts';
import type { McqQuestion, Question } from '../content/types.ts';
import { seededRandom } from '../random.ts';
import { DAY_MS } from '../scheduler/day.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { reviewEvent } from '../storageContract.test-util.ts';
import { replayCards } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import {
  confusableCount,
  confusableDrill,
  confusablePairs,
  drillItems,
  dueToday,
  topicDrill,
  weakSpotDrill,
  type DrillInput,
  type DrillSize,
} from './drill.ts';

const scheduler = fsrsScheduler();
// 2026-11-24 12:00 UTC = 13:00 CET.
const NOW = Date.UTC(2026, 10, 24, 12);
const CET = 60;

const q = (id: string, overrides: Partial<McqQuestion> = {}): McqQuestion =>
  mcq({ id, status: 'verified', verified_on: '2026-01-02', ...overrides });

let seq = 0;
const ev = (cardId: string, ts: number, overrides: Partial<ReviewEvent> = {}): ReviewEvent =>
  reviewEvent({
    eventId: `e${String((seq += 1)).padStart(4, '0')}`,
    cardId,
    ts,
    mode: 'scheduled',
    rating: 'good',
    ...overrides,
  });

function input(
  questions: Question[],
  events: ReviewEvent[] = [],
  size: DrillSize = 10,
  now = NOW,
): DrillInput {
  return {
    questions: new Map(questions.map((x) => [x.id, x])),
    cards: replayCards(events, scheduler),
    events,
    scheduler,
    now,
    offsetMinutes: CET,
    random: seededRandom(7),
    size,
  };
}

describe('dueToday and drillItems', () => {
  // Reviewed 20 days ago: long overdue. Reviewed an hour ago: due in days.
  const events = [ev('old', NOW - 20 * DAY_MS), ev('recent', NOW - 3_600_000)];
  const data = input([q('old'), q('recent'), q('new')], events);

  it('marks only cards due before the next 04:00 as scheduled', () => {
    expect(dueToday(data.cards, 'old', NOW, CET)).toBe(true);
    expect(dueToday(data.cards, 'recent', NOW, CET)).toBe(false);
    expect(dueToday(data.cards, 'new', NOW, CET)).toBe(false);
    const items = drillItems(['old', 'recent', 'new', 'missing'], data);
    expect(items.map((i) => [i.questionId, i.mode])).toEqual([
      ['old', 'scheduled'],
      ['recent', 'extra'],
      ['new', 'extra'],
    ]);
  });

  it('counts a card due later today, before 04:00 tomorrow, as due', () => {
    const card = data.cards.get('recent')?.scheduler;
    expect(card).toBeDefined();
    const justBefore = (card?.due ?? 0) - 1;
    // Seen from the evening of the day before it falls due, it is not due yet.
    expect(dueToday(data.cards, 'recent', justBefore - DAY_MS, CET)).toBe(false);
    expect(dueToday(data.cards, 'recent', justBefore, CET)).toBe(true);
  });
});

describe('topicDrill', () => {
  const questions = [
    q('a1', { tier: 'foundational', tags: ['contrast'] }),
    q('a2', { tier: 'advanced' }),
    q('a3', { tier: 'foundational', tags: ['history'] }),
    q('b1', { tier: 'foundational' }),
    mcq({ id: 'draft', status: 'draft' }),
    recall({ id: 'r1', status: 'verified', verified_on: '2026-01-02' }),
  ];

  it('filters by scope, tier and tag, and leaves drafts out', () => {
    const scope = new Set(['a1', 'a2', 'a3', 'draft']);
    const ids = (f: Parameters<typeof topicDrill>[1]) =>
      topicDrill(input(questions), f)
        .map((i) => i.questionId)
        .sort();
    expect(ids({ scope })).toEqual(['a1', 'a2', 'a3']);
    expect(ids({ scope, tier: 'foundational' })).toEqual(['a1', 'a3']);
    expect(ids({ scope, tag: 'history' })).toEqual(['a3']);
    expect(ids({})).toEqual(['a1', 'a2', 'a3', 'b1', 'r1']);
  });

  it('puts due items first, then the weakest started, then new ones', () => {
    const events = [
      ev('a1', NOW - 3_600_000), // started an hour ago, not due
      ev('a2', NOW - 30 * DAY_MS), // due
      ev('a3', NOW - DAY_MS), // started a day ago: weaker than a1, not due
    ];
    const data = input(questions, events);
    expect(dueToday(data.cards, 'a3', NOW, CET)).toBe(false);
    const order = topicDrill(data, { scope: new Set(['a1', 'a2', 'a3', 'b1']) }).map(
      (i) => i.questionId,
    );
    expect(order[0]).toBe('a2');
    expect(order.indexOf('a3')).toBeLessThan(order.indexOf('a1'));
    expect(order.at(-1)).toBe('b1');
  });

  it('cuts to the drill size; All keeps everything', () => {
    const many = Array.from({ length: 25 }, (_, i) => q(`m${i}`));
    expect(topicDrill(input(many, [], 10), {})).toHaveLength(10);
    expect(topicDrill(input(many, [], 20), {})).toHaveLength(20);
    expect(topicDrill(input(many, [], 'all'), {})).toHaveLength(25);
  });
});

describe('weakSpotDrill', () => {
  it('drills the weak-spot list with due items as reviews', () => {
    const events = [
      ev('w1', NOW - 2 * DAY_MS),
      ev('w1', NOW - DAY_MS, { correct: false, rating: 'again' }),
      ev('w2', NOW - 3_600_000),
      ev('w2', NOW - 1000, { mode: 'extra', correct: false, rating: 'again' }),
      ev('fine', NOW - 3_600_000),
    ];
    const items = weakSpotDrill(input([q('w1'), q('w2'), q('fine')], events));
    expect(items.map((i) => i.questionId).sort()).toEqual(['w1', 'w2']);
    // w1 lapsed yesterday and is due again; w2 only missed in extra practice.
    expect(items.find((i) => i.questionId === 'w1')?.mode).toBe('scheduled');
    expect(items.find((i) => i.questionId === 'w2')?.mode).toBe('extra');
  });
});

describe('confusable drills', () => {
  const questions = [
    q('p1', { confusable_with: ['p2'] }),
    q('p2', { confusable_with: ['p1'] }),
    q('p3', { confusable_with: ['p4', 'gone'] }),
    q('p4'),
    q('c1', { tags: ['contrast'] }),
    q('c2', { tags: ['contrast'] }),
    mcq({ id: 'd1', status: 'draft', confusable_with: ['p1'] }),
  ];
  const map = new Map(questions.map((x) => [x.id, x]));

  it('lists each verified pair once, in either direction', () => {
    expect(confusablePairs(map)).toEqual([
      { a: 'p1', b: 'p2' },
      { a: 'p3', b: 'p4' },
    ]);
    expect(confusableCount(map)).toEqual({ pairs: 2, questions: 6 });
  });

  it('shows pairs back to back, missed pairs first, then contrast items', () => {
    const events = [ev('p4', NOW - DAY_MS, { mode: 'extra', correct: false, rating: 'again' })];
    const ids = confusableDrill(input(questions, events)).map((i) => i.questionId);
    expect(ids.slice(0, 4)).toEqual(['p4', 'p3', 'p1', 'p2']);
    expect(ids.slice(4).sort()).toEqual(['c1', 'c2']);
  });

  it('respects the size', () => {
    expect(confusableDrill(input(questions, [], 10))).toHaveLength(6);
    const big = Array.from({ length: 30 }, (_, i) => q(`x${i}`, { tags: ['contrast'] }));
    expect(confusableDrill(input(big, [], 20))).toHaveLength(20);
    expect(confusableDrill(input(big, [], 'all'))).toHaveLength(30);
  });
});

describe('drill logging', () => {
  it('extra practice never changes replayed FSRS state', () => {
    const scheduled = [ev('a', NOW - 10 * DAY_MS), ev('a', NOW - 5 * DAY_MS)];
    const extra = [
      ev('a', NOW - 3 * DAY_MS, { mode: 'extra', correct: false, rating: 'again' }),
      ev('a', NOW - DAY_MS, { mode: 'extra' }),
    ];
    const plain = replayCards(scheduled, scheduler).get('a')?.scheduler;
    const mixed = replayCards([...scheduled, ...extra], scheduler).get('a')?.scheduler;
    expect(mixed).toEqual(plain);
  });
});
