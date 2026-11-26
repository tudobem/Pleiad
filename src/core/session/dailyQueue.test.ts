import { describe, expect, it } from 'vitest';
import { buildDailyQueue, pickByTierMix, prerequisitesMet, tierUnlocked } from './dailyQueue.ts';
import { mcq, recall, short } from '../content/fixtures.test-util.ts';
import type { McqQuestion, Tier } from '../content/types.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { DAY_MS } from '../scheduler/day.ts';
import { DEFAULT_SETTINGS, type Settings } from '../settings.ts';
import { replayCards } from '../sync/replay.ts';
import { reviewEvent } from '../storageContract.test-util.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

const scheduler = fsrsScheduler();
// 2026-11-24 12:00 UTC = 13:00 CET.
const NOW = Date.UTC(2026, 10, 24, 12);
const CET = 60;

const q = (id: string, overrides: Partial<McqQuestion> = {}): McqQuestion =>
  mcq({ id, status: 'verified', verified_on: '2026-01-02', ...overrides });

let seq = 0;
const ev = (cardId: string, ts: number, overrides: Partial<ReviewEvent> = {}): ReviewEvent =>
  reviewEvent({
    eventId: `e${(seq += 1)}`,
    cardId,
    ts,
    mode: 'scheduled',
    rating: 'good',
    ...overrides,
  });

function queue(
  questions: McqQuestion[],
  events: ReviewEvent[] = [],
  settings: Partial<Settings> = {},
  now = NOW,
) {
  return buildDailyQueue({
    questions,
    cards: replayCards(events, scheduler),
    events,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    now,
    offsetMinutes: CET,
  });
}

describe('buildDailyQueue', () => {
  const pool = Array.from({ length: 15 }, (_, i) => q(`n${String(i).padStart(2, '0')}`));

  it('offers new items up to the daily limit on a fresh profile', () => {
    const result = queue(pool);
    expect(result.due).toEqual([]);
    expect(result.fresh).toHaveLength(10);
    expect(new Set(result.fresh).size).toBe(10);
  });

  it('counts items introduced earlier today against the limit', () => {
    const events = ['n00', 'n01', 'n02'].map((id) => ev(id, NOW - 3_600_000));
    const result = queue(pool, events);
    expect(result.fresh).toHaveLength(7);
    expect(result.fresh).not.toContain('n00');
    // Introduced today and answered Good: due on a later day, not again today.
    expect(result.due).toEqual([]);
  });

  it('lists due reviews first, most overdue first, and caps them', () => {
    const events = [
      ev('n00', NOW - 20 * DAY_MS),
      ev('n01', NOW - 30 * DAY_MS),
      ev('n02', NOW - 25 * DAY_MS),
    ];
    const result = queue(pool, events, { newPerDay: 0 });
    expect(result.due).toEqual(['n01', 'n02', 'n00']);
    expect(queue(pool, events, { newPerDay: 0, reviewCap: 2 }).due).toEqual(['n01', 'n02']);
  });

  it('subtracts reviews already done today from the cap', () => {
    const events = [
      ev('n00', NOW - 30 * DAY_MS),
      ev('n01', NOW - 30 * DAY_MS),
      ev('n02', NOW - 30 * DAY_MS),
      ev('n03', NOW - 30 * DAY_MS),
      ev('n03', NOW - 1_000),
    ];
    const result = queue(pool, events, { newPerDay: 0, reviewCap: 2 });
    expect(result.due).toHaveLength(1);
    expect(result.due).not.toContain('n03');
  });

  it('switches day at 04:00 local time', () => {
    // A card reviewed with "again" is due about a day later.
    const reviewed = NOW - DAY_MS;
    const events = [ev('n00', reviewed, { rating: 'again', correct: false })];
    const due = replayCards(events, scheduler).get('n00')?.scheduler?.due ?? 0;
    const beforeBoundary = queue(pool, events, { newPerDay: 0 }, due - DAY_MS);
    expect(beforeBoundary.due).toEqual([]);
    expect(queue(pool, events, { newPerDay: 0 }, due).due).toEqual(['n00']);
  });

  it('is stable for the same day and interleaves packs', () => {
    const mixed = pool.map((x, i) => ({ ...x, pack: i % 2 === 0 ? 'a' : 'b' }));
    const first = queue(mixed);
    expect(queue(mixed, [], {}, NOW + 3_600_000)).toEqual(first);
    const packs = first.fresh.map((id) => mixed.find((x) => x.id === id)?.pack);
    // Consecutive items come from different packs while both have items left.
    for (let i = 1; i < 6; i += 1) expect(packs[i]).not.toBe(packs[i - 1]);
  });

  it('includes every supported type and alternates types', () => {
    const v = { status: 'verified' as const, verified_on: '2026-01-02' };
    const mixed = [
      q('m1'),
      q('m2'),
      q('m3'),
      recall({ ...v, id: 'r1' }),
      recall({ ...v, id: 'r2' }),
      short({ ...v, id: 's1' }),
    ];
    const ids = buildDailyQueue({
      questions: mixed,
      cards: new Map(),
      events: [],
      settings: DEFAULT_SETTINGS,
      now: NOW,
      offsetMinutes: CET,
    }).fresh;
    expect([...ids].sort()).toEqual(['m1', 'm2', 'm3', 'r1', 'r2', 's1']);
    const type = (id: string) => mixed.find((x) => x.id === id)?.type;
    expect(type(ids[0] ?? '')).not.toBe(type(ids[1] ?? ''));
  });

  it('never offers locked tiers on a fresh profile', () => {
    const tiered = [
      ...Array.from({ length: 5 }, (_, i) => q(`f${i}`)),
      ...Array.from({ length: 5 }, (_, i) => q(`a${i}`, { tier: 'advanced' })),
    ];
    const ids = queue(tiered).fresh;
    expect(ids.every((id) => id.startsWith('f'))).toBe(true);
  });
});

describe('tierUnlocked (SPEC 7.2)', () => {
  const topic = [
    ...Array.from({ length: 5 }, (_, i) => q(`f${i}`)),
    ...Array.from({ length: 5 }, (_, i) => q(`a${i}`, { tier: 'advanced' })),
    q('x0', { tier: 'expert' }),
  ];
  const cardsWith = (ids: string[]) =>
    replayCards(
      ids.map((id) => ev(id, NOW - DAY_MS)),
      scheduler,
    );

  it('unlocks advanced at 80% of foundational introduced', () => {
    const adv = topic.find((x) => x.id === 'a0') as McqQuestion;
    expect(tierUnlocked(adv, topic, cardsWith(['f0', 'f1', 'f2']), true)).toBe(false);
    expect(tierUnlocked(adv, topic, cardsWith(['f0', 'f1', 'f2', 'f3']), true)).toBe(true);
    expect(tierUnlocked(adv, topic, cardsWith(['f0', 'f1', 'f2', 'f3']), false)).toBe(false);
  });

  it('unlocks expert at 80% of advanced introduced', () => {
    const exp = topic.find((x) => x.id === 'x0') as McqQuestion;
    const four = ['f0', 'f1', 'f2', 'f3'];
    expect(tierUnlocked(exp, topic, cardsWith(four), true)).toBe(false);
    expect(tierUnlocked(exp, topic, cardsWith([...four, 'a0', 'a1', 'a2', 'a3']), true)).toBe(true);
  });

  it('treats an empty lower tier as satisfied', () => {
    const lonely = q('lone', { tier: 'advanced', topic: 'gwt' });
    expect(tierUnlocked(lonely, [lonely], new Map(), true)).toBe(true);
  });

  it('only counts questions of the same topic', () => {
    const other = q('o0', { tier: 'advanced', topic: 'gwt' });
    expect(tierUnlocked(other, [...topic, other], new Map(), true)).toBe(true);
  });
});

describe('prerequisitesMet', () => {
  const base = q('base', { concepts: ['phi'] });
  const needsQuestion = q('needs-q', { prerequisites: ['base'] });
  const needsConcept = q('needs-c', { prerequisites: ['phi'] });
  const byId = new Map([base, needsQuestion, needsConcept].map((x) => [x.id, x]));

  it('requires the prerequisite question or concept to be introduced', () => {
    expect(prerequisitesMet(needsQuestion, byId, new Map())).toBe(false);
    expect(prerequisitesMet(needsConcept, byId, new Map())).toBe(false);
    const cards = replayCards([ev('base', NOW - DAY_MS)], scheduler);
    expect(prerequisitesMet(needsQuestion, byId, cards)).toBe(true);
    expect(prerequisitesMet(needsConcept, byId, cards)).toBe(true);
  });

  it('gates new items in the queue', () => {
    expect(queue([needsQuestion]).fresh).toEqual([]);
  });
});

describe('pickByTierMix', () => {
  const pools = (f: number, a: number, e: number) =>
    new Map<Tier, string[]>([
      ['foundational', Array.from({ length: f }, (_, i) => `f${i}`)],
      ['advanced', Array.from({ length: a }, (_, i) => `a${i}`)],
      ['expert', Array.from({ length: e }, (_, i) => `x${i}`)],
    ]);
  const mix = DEFAULT_SETTINGS.tierMix;
  const count = (ids: string[], p: string) => ids.filter((id) => id.startsWith(p)).length;

  it('splits 60/30/10', () => {
    const ids = pickByTierMix(pools(20, 20, 20), mix, 10);
    expect([count(ids, 'f'), count(ids, 'a'), count(ids, 'x')]).toEqual([6, 3, 1]);
  });

  it('moves unused slots to tiers that have items', () => {
    const ids = pickByTierMix(pools(20, 1, 0), mix, 10);
    expect([count(ids, 'f'), count(ids, 'a'), count(ids, 'x')]).toEqual([9, 1, 0]);
    expect(pickByTierMix(pools(3, 0, 0), mix, 10)).toHaveLength(3);
    expect(pickByTierMix(pools(5, 5, 5), mix, 0)).toEqual([]);
  });
});
