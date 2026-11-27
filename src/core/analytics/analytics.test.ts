import { describe, expect, it } from 'vitest';
import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import { mcq } from '../content/fixtures.test-util.ts';
import { emptyCounts } from '../content/report.ts';
import type { Question } from '../content/types.ts';
import { DAY_MS, dayStartMs, learningDay } from '../scheduler/day.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { reviewEvent } from '../storageContract.test-util.ts';
import { replayCards } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { accuracyOf } from './accuracy.ts';
import { activity, intensity } from './activity.ts';
import { masteryOf } from './retention.ts';
import { buildStats, sortTopics } from './stats.ts';
import { LEECH_LAPSES, weakSpots } from './weakSpots.ts';

const scheduler = fsrsScheduler();
// 2026-11-24 12:00 UTC, CET (+60).
const NOW = Date.UTC(2026, 10, 24, 12);
const CET = 60;

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

const node = (
  id: string,
  kind: IndexTreeNode['kind'],
  children: IndexTreeNode[] = [],
  extra: Partial<IndexTreeNode> = {},
): IndexTreeNode => ({
  id,
  label: extra.label ?? id,
  kind,
  packs: [],
  counts: emptyCounts(),
  children,
  ...extra,
});
const topic = (id: string, ids: string[]) => node(id, 'topic', [], { questionIds: ids, tags: [] });

const INDEX: ContentIndex = {
  version: 3,
  packs: [],
  tree: [
    node('d', 'domain', [
      node('subj', 'subject', [
        node('b1', 'branch', [topic('t-old', ['a1', 'a2']), topic('t-new', ['b1', 'b2'])]),
        node('b2', 'branch', [topic('t-empty', [])]),
      ]),
    ]),
  ],
};

describe('masteryOf', () => {
  it('averages retrievability over started items only', () => {
    const events = [ev('a1', NOW - 10 * DAY_MS), ev('retired', NOW - 10 * DAY_MS)];
    const cards = replayCards(events, scheduler);
    const m = masteryOf(['a1', 'a2'], cards, scheduler, NOW);
    expect(m.started).toBe(1);
    expect(m.verified).toBe(2);
    const state = cards.get('a1')?.scheduler;
    expect(state).toBeTruthy();
    if (state) expect(m.retention).toBeCloseTo(scheduler.retrievability(state, NOW), 10);
    expect(masteryOf(['a2'], cards, scheduler, NOW).retention).toBeNull();
  });

  it('ignores extra practice, which never starts a card', () => {
    const cards = replayCards([ev('a1', NOW - DAY_MS, { mode: 'extra' })], scheduler);
    expect(masteryOf(['a1'], cards, scheduler, NOW).started).toBe(0);
  });
});

describe('buildStats', () => {
  const miss = { correct: false, rating: 'again' as const };
  const events = [
    // t-old: answered long ago (outside the 30-day window).
    ev('a1', NOW - 60 * DAY_MS),
    ev('a2', NOW - 60 * DAY_MS),
    // t-new: 1 right, 3 wrong recently (an extra-practice miss counts too).
    ev('b1', NOW - 3 * DAY_MS),
    ev('b1', NOW - 2 * DAY_MS, miss),
    ev('b1', NOW - DAY_MS, { ...miss, mode: 'extra' }),
    ev('b1', NOW - 3_600_000, miss),
    // A retired question still counts in overall accuracy.
    ev('retired', NOW - 3_600_000),
  ];
  const stats = buildStats({
    index: INDEX,
    cards: replayCards(events, scheduler),
    scheduler,
    now: NOW,
    events,
  });

  it('rolls up per subject and topic and skips empty topics', () => {
    expect(stats.overall).toMatchObject({ started: 3, verified: 4, coverage: 0.75 });
    expect(stats.subjects.map((s) => s.id)).toEqual(['subj']);
    expect(stats.topics.map((t) => [t.id, t.branchId, t.started])).toEqual([
      ['t-old', 'b1', 2],
      ['t-new', 'b1', 1],
    ]);
  });

  it('measures accuracy over the last 30 days', () => {
    expect(stats.overall.accuracy).toEqual({ answered: 5, right: 2, share: 0.4 });
    const old = stats.topics.find((t) => t.id === 't-old');
    const fresh = stats.topics.find((t) => t.id === 't-new');
    expect(old?.accuracy).toEqual({ answered: 0, right: 0, share: null });
    expect(fresh?.accuracy).toEqual({ answered: 4, right: 1, share: 0.25 });
  });

  it('marks topics weak by recent accuracy, not by expected recall', () => {
    const old = stats.topics.find((t) => t.id === 't-old');
    const fresh = stats.topics.find((t) => t.id === 't-new');
    expect(old?.retention).toBeLessThan(0.85);
    expect(old?.weak).toBe(false);
    expect(fresh?.weak).toBe(true);
  });

  it('sorts weakest first by accuracy, expected recall or coverage', () => {
    // No recent answers sorts last by accuracy.
    expect(sortTopics(stats.topics, 'accuracy').map((t) => t.id)).toEqual(['t-new', 't-old']);
    expect(sortTopics(stats.topics, 'retention').map((t) => t.id)).toEqual(['t-old', 't-new']);
    expect(sortTopics(stats.topics, 'coverage').map((t) => t.id)).toEqual(['t-new', 't-old']);
  });
});

describe('accuracyOf', () => {
  it('counts right answers in the window, optionally for some questions', () => {
    const events = [
      ev('x', NOW - 40 * DAY_MS),
      ev('x', NOW - DAY_MS),
      ev('y', NOW - DAY_MS, { correct: false, rating: 'again' }),
    ];
    expect(accuracyOf(events, NOW)).toEqual({ answered: 2, right: 1, share: 0.5 });
    expect(accuracyOf(events, NOW, new Set(['x']))).toEqual({ answered: 1, right: 1, share: 1 });
    expect(accuracyOf([], NOW).share).toBeNull();
  });
});

describe('activity', () => {
  const today = learningDay(NOW, CET);
  const at = (daysAgo: number, hour = 12) =>
    dayStartMs(today - daysAgo, CET) + (hour - 4) * 3_600_000;

  it('counts answers per learning day with the 04:00 boundary', () => {
    // 03:30 local on the 24th belongs to the 23rd.
    const late = dayStartMs(today, CET) - 30 * 60_000;
    const a = activity([ev('x', at(0)), ev('x', at(0)), ev('y', late)], NOW, CET);
    expect(a.days).toHaveLength(35);
    expect(a.days.at(-1)).toEqual({ day: today, count: 2 });
    expect(a.days.at(-2)).toEqual({ day: today - 1, count: 1 });
    expect(a.today).toBe(2);
    expect(a.total).toBe(3);
  });

  it('computes current and longest streaks', () => {
    const run = (daysAgo: number[]) =>
      activity(
        daysAgo.map((d) => ev('x', at(d))),
        NOW,
        CET,
      );
    expect(run([])).toMatchObject({ currentStreak: 0, longestStreak: 0 });
    expect(run([0, 1, 2])).toMatchObject({ currentStreak: 3, longestStreak: 3 });
    // Not practiced yet today: the streak still runs up to yesterday.
    expect(run([1, 2])).toMatchObject({ currentStreak: 2, longestStreak: 2 });
    expect(run([2, 3])).toMatchObject({ currentStreak: 0, longestStreak: 2 });
    expect(run([0, 5, 6, 7, 8])).toMatchObject({ currentStreak: 1, longestStreak: 4 });
  });

  it('maps counts to five intensity steps', () => {
    expect([0, 1, 5, 10, 20].map((c) => intensity(c, 20))).toEqual([0, 1, 1, 2, 4]);
    expect(intensity(3, 0)).toBe(0);
  });
});

describe('weakSpots', () => {
  const q = (id: string): [string, Question] => [
    id,
    mcq({ id, topic: `topic-${id}`, status: 'verified', verified_on: '2026-01-01' }),
  ];
  const questions = new Map([q('ok'), q('missed'), q('extra'), q('stale'), q('leech'), q('new')]);

  // A first review, then LEECH_LAPSES lapses from the review phase.
  const lapses = [
    ev('leech', NOW - 120 * DAY_MS),
    ...Array.from({ length: LEECH_LAPSES }, (_, i) => [
      ev('leech', NOW - (100 - 2 * i) * DAY_MS, { correct: false, rating: 'again' }),
      ev('leech', NOW - (99 - 2 * i) * DAY_MS),
    ]).flat(),
  ];
  const events = [
    ev('ok', NOW - 3_600_000),
    ev('missed', NOW - 2 * DAY_MS),
    ev('missed', NOW - DAY_MS, { correct: false, rating: 'again' }),
    ev('extra', NOW - 3_600_000),
    ev('extra', NOW - 1000, { mode: 'extra', correct: false, rating: 'again' }),
    ev('stale', NOW - 200 * DAY_MS),
    ...lapses,
    // A miss outside the 30-day window does not count.
    ev('ok', NOW - 40 * DAY_MS, { mode: 'extra', correct: false, rating: 'again' }),
  ];
  const cards = replayCards(events, scheduler);
  const spots = weakSpots({ questions, cards, events, scheduler, now: NOW });

  it('lists missed, low-retrievability and leech cards, not healthy or unstarted ones', () => {
    const ids = spots.map((s) => s.questionId);
    expect(ids).toEqual(expect.arrayContaining(['missed', 'extra', 'stale', 'leech']));
    expect(ids).not.toContain('ok');
    expect(ids).not.toContain('new');
    expect(cards.get('leech')?.scheduler?.lapses).toBe(LEECH_LAPSES);
    expect(spots.find((s) => s.questionId === 'leech')?.leech).toBe(true);
    expect(spots.find((s) => s.questionId === 'extra')?.misses).toBe(1);
  });

  it('ranks by score and respects the limit', () => {
    const scores = spots.map((s) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(weakSpots({ questions, cards, events, scheduler, now: NOW, limit: 2 })).toHaveLength(2);
  });

  it('counts high-confidence errors', () => {
    const certain = [
      ev('ok', NOW - 1000, { correct: false, rating: 'again', confidence: 'certain' }),
    ];
    const all = [...events, ...certain];
    const s = weakSpots({
      questions,
      cards: replayCards(all, scheduler),
      events: all,
      scheduler,
      now: NOW,
    });
    expect(s.find((x) => x.questionId === 'ok')?.confidentErrors).toBe(1);
  });
});
