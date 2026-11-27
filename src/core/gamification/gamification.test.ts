import { describe, expect, it } from 'vitest';
import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import { mcq } from '../content/fixtures.test-util.ts';
import { emptyCounts } from '../content/report.ts';
import { dayStartMs, learningDay } from '../scheduler/day.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { buildDailyQueue } from '../session/dailyQueue.ts';
import { DEFAULT_SETTINGS } from '../settings.ts';
import { reviewEvent } from '../storageContract.test-util.ts';
import { replayCards } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { BADGES, badgeStates } from './badges.ts';
import { CHALLENGES, challengeFor, challengeProgress } from './challenges.ts';
import { answersPerDay, goalProgress, goalStreak, weekOf, weekStart } from './goal.ts';
import { buildRewards, sessionXp } from './rewards.ts';
import { levelFor, subjectTitle, xpForEvents, xpForLevel } from './xp.ts';

const UTC = 0;
// Thursday 2026-11-26 12:00 UTC.
const NOW = Date.UTC(2026, 10, 26, 12);
const TODAY = learningDay(NOW, UTC);
let seq = 0;
const ev = (cardId: string, day: number, overrides: Partial<ReviewEvent> = {}) =>
  reviewEvent({
    eventId: `e${String((seq += 1)).padStart(5, '0')}`,
    cardId,
    ts: dayStartMs(day, UTC) + 6 * 3_600_000 + seq,
    mode: 'scheduled',
    correct: true,
    rating: 'good',
    ...overrides,
  });
/** `n` answers on each listed day. */
const onDays = (days: number[], n = 20) =>
  days.flatMap((d) => Array.from({ length: n }, () => ev('x', d)));

describe('weeks and goal', () => {
  it('runs weeks Monday to Sunday', () => {
    expect(new Date(dayStartMs(weekStart(weekOf(TODAY)), UTC)).getUTCDay()).toBe(1);
    expect(weekOf(weekStart(10))).toBe(10);
    expect(weekOf(weekStart(10) + 6)).toBe(10);
    expect(weekOf(weekStart(10) + 7)).toBe(11);
  });

  it('counts answers today against the goal', () => {
    const perDay = answersPerDay([...onDays([TODAY], 12), ...onDays([TODAY - 1], 30)], UTC);
    expect(goalProgress(perDay, TODAY, 20)).toEqual({ done: 12, goal: 20, ratio: 0.6, met: false });
  });
});

describe('goalStreak', () => {
  const streak = (days: number[], goal = 20) =>
    goalStreak(answersPerDay(onDays(days), UTC), TODAY, goal);

  it('counts days that met the goal, today once met', () => {
    expect(streak([])).toEqual({ current: 0, longest: 0 });
    expect(streak([TODAY, TODAY - 1, TODAY - 2])).toEqual({ current: 3, longest: 3 });
    expect(streak([TODAY - 1, TODAY - 2])).toEqual({ current: 2, longest: 2 });
    // Below the goal does not count.
    expect(goalStreak(answersPerDay(onDays([TODAY], 5), UTC), TODAY, 20).current).toBe(0);
  });

  it('forgives one missed day per week without counting it', () => {
    // Thursday TODAY: Mon..Wed met, Tue missed in the same week.
    expect(streak([TODAY, TODAY - 1, TODAY - 3])).toEqual({ current: 3, longest: 3 });
    // A second miss in the same week (Wednesday and Monday) breaks it.
    expect(streak([TODAY, TODAY - 2, TODAY - 4]).current).toBe(2);
    // Misses in different weeks (Wednesday, and the Sunday before) are each forgiven.
    expect(streak([TODAY, TODAY - 2, TODAY - 3, TODAY - 5]).current).toBe(4);
    // Two misses in a row are never bridged.
    expect(streak([TODAY, TODAY - 3, TODAY - 4]).current).toBe(1);
    // Yesterday missed but today still open: the grace keeps the streak.
    expect(streak([TODAY - 2, TODAY - 3]).current).toBe(2);
  });
});

describe('XP and levels', () => {
  it('weights correct answers by tier and adds the bonuses', () => {
    const tiers: Record<string, number> = { a: 1, b: 3 };
    const events = [
      ev('a', TODAY - 2),
      ev('b', TODAY - 2, { correct: false, rating: 'again' }),
      ev('b', TODAY - 1),
      ev('a', TODAY, { confidence: 'certain' }),
    ];
    const r = xpForEvents(events, (id) => tiers[id] ?? 1);
    // a: 1, b: miss then 3 + 2 recovery, a: 1 + 1 certain.
    expect(r.total).toBe(8);
    expect(r.byCard.get('b')).toBe(5);
    expect(r.recoveries.map((e) => e.cardId)).toEqual(['b']);
  });

  it('maps XP to levels and titles', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 50, 150, 300]);
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'First Light', into: 0, toNext: 50 });
    expect(levelFor(160)).toMatchObject({ level: 3, title: 'Stargazer', into: 10, toNext: 140 });
    expect(levelFor(xpForLevel(30)).title).toBe('Luminary');
    expect([0, 99, 100, 700, 5000].map(subjectTitle)).toEqual([
      'Newcomer',
      'Newcomer',
      'Apprentice',
      'Scholar',
      'Sage',
    ]);
  });
});

describe('weekly challenge', () => {
  const ctx = { offsetMinutes: UTC, goal: 20, topicOf: (id: string) => `t-${id}`, recoveries: [] };

  it('picks the same challenge for a week and rotates through the list', () => {
    const week = weekOf(TODAY);
    expect(challengeFor(week)).toEqual(challengeFor(week));
    const ids = new Set(
      Array.from({ length: CHALLENGES.length }, (_, i) => challengeFor(week + i).id),
    );
    expect(ids.size).toBe(CHALLENGES.length);
  });

  it('counts progress within the week only', () => {
    const start = weekStart(weekOf(TODAY));
    // Find a week whose challenge is "topics", then count topics answered in it.
    const offset = CHALLENGES.findIndex((c) => c.id === 'topics');
    const week =
      weekOf(TODAY) +
      ((offset - (weekOf(TODAY) % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length);
    const ws = weekStart(week);
    const events = ['a', 'b', 'c', 'd', 'e'].map((id) => ev(id, ws + 1));
    const p = challengeProgress([...events, ev('z', ws - 1)], week, ctx);
    expect(p).toMatchObject({ id: 'topics', target: 5, value: 5, done: true, reward: 100 });
    expect(start).toBeLessThanOrEqual(TODAY);
  });
});

describe('badges', () => {
  const none = {
    answers: 0,
    longestGoalStreak: 0,
    recoveredCards: 0,
    topicsStarted: 0,
    brightSubject: false,
    challengesDone: 0,
    calibratedWeeks: 0,
  };
  it('earns each badge at its threshold', () => {
    expect(badgeStates(none).every((b) => !b.earned)).toBe(true);
    const all = badgeStates({
      answers: 100,
      longestGoalStreak: 30,
      recoveredCards: 10,
      topicsStarted: 10,
      brightSubject: true,
      challengesDone: 1,
      calibratedWeeks: 1,
    });
    expect(all.every((b) => b.earned)).toBe(true);
    expect(BADGES).toHaveLength(9);
    expect(
      badgeStates({ ...none, answers: 1, longestGoalStreak: 7 })
        .filter((b) => b.earned)
        .map((b) => b.id),
    ).toEqual(['first-light', 'week-of-light']);
  });
});

const node = (
  id: string,
  kind: IndexTreeNode['kind'],
  children: IndexTreeNode[] = [],
  extra: Partial<IndexTreeNode> = {},
): IndexTreeNode => ({
  id,
  label: id,
  kind,
  packs: [],
  counts: emptyCounts(),
  children,
  ...extra,
});
const INDEX: ContentIndex = {
  version: 4,
  packs: [],
  tree: [
    node('d', 'domain', [
      node('subj', 'subject', [
        node('t1', 'topic', [], { questionIds: ['a', 'b'], tiers: [1, 2] }),
      ]),
    ]),
  ],
};

describe('buildRewards', () => {
  const scheduler = fsrsScheduler();
  const events = [...onDays([TODAY - 1], 20).map((e) => ({ ...e, cardId: 'a' })), ev('b', TODAY)];
  const rewards = buildRewards({
    events,
    index: INDEX,
    cards: replayCards(events, scheduler),
    scheduler,
    now: NOW,
    offsetMinutes: UTC,
    dailyGoal: 20,
  });

  it('combines goal, streak, XP, level, badges and subject titles', () => {
    expect(rewards.goal).toMatchObject({ done: 1, goal: 20 });
    expect(rewards.streak.current).toBe(1);
    expect(rewards.xp).toBe(22);
    expect(rewards.level.level).toBe(1);
    expect(rewards.badges.find((b) => b.id === 'first-light')?.earned).toBe(true);
    expect(rewards.subjects).toEqual([{ id: 'subj', label: 'subj', xp: 22, title: 'Newcomer' }]);
  });

  it('gives the XP of a session from its own answers', () => {
    const last = events.at(-1);
    expect(sessionXp(events, new Set(last ? [last.eventId] : []), INDEX)).toBe(2);
  });

  it('never changes the Daily queue', () => {
    const questions = ['a', 'b', 'c'].map((id) =>
      mcq({ id, status: 'verified', verified_on: '2026-01-01' }),
    );
    const input = {
      questions,
      cards: replayCards(events, scheduler),
      events,
      now: NOW,
      offsetMinutes: UTC,
    };
    const on = buildDailyQueue({
      ...input,
      settings: { ...DEFAULT_SETTINGS, rewards: true, dailyGoal: 5 },
    });
    const off = buildDailyQueue({
      ...input,
      settings: { ...DEFAULT_SETTINGS, rewards: false, dailyGoal: 200 },
    });
    expect(on).toEqual(off);
  });
});
