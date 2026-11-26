import { describe, expect, it } from 'vitest';
import { fixedClock } from '../core/clock.ts';
import { mcq } from '../core/content/fixtures.test-util.ts';
import type { Question } from '../core/content/types.ts';
import { sequentialIds } from '../core/ids.ts';
import { memoryStorage } from '../core/memoryStorage.ts';
import { seededRandom } from '../core/random.ts';
import { DAY_MS, learningDay } from '../core/scheduler/day.ts';
import { startSession, sessionReducer, type SessionState } from '../core/session/reducer.ts';
import { replayCards } from '../core/sync/replay.ts';
import type { ContentIndex, IndexPack } from '../core/content/contentIndex.ts';
import { emptyCounts } from '../core/content/report.ts';
import type { ContentSource, PackContent } from '../core/content/source.ts';
import {
  closeSession,
  commitPending,
  loadActiveLearning,
  loadLearningData,
  loadResumableSession,
  loadSettings,
  setPacksActive,
  startDrillSession,
  startSubjectSession,
} from './learning.ts';
import type { Services } from './services.ts';

const NOW = Date.UTC(2026, 10, 26, 12);
const live: Question = mcq({ id: 'live-1', status: 'verified', verified_on: '2026-02-01' });

function setup(now = NOW) {
  const storage = memoryStorage();
  const services: Services = {
    storage,
    // Content is not used by these functions.
    content: {
      loadIndex: () => Promise.reject(new Error('unused')),
      loadPack: () => Promise.reject(new Error('unused')),
      keepOffline: () => Promise.resolve(),
    },
    clock: fixedClock(now),
    random: seededRandom(1),
    ids: sequentialIds('ev'),
    identity: { deviceId: 'd', profileId: 'p' },
    appVersion: 'test',
    persistent: true,
  };
  return { storage, services };
}

/** A session paused on the feedback screen of question `id`, answered at `answeredAt`. */
function pausedOn(
  id: string,
  correct: boolean,
  day: number,
  mode: 'scheduled' | 'extra' = 'scheduled',
): SessionState {
  const items = [{ questionId: id, layout: [0, 1, 2, 3] }];
  return [
    { type: 'respond', response: { type: 'mcq', choice: 0 } },
    { type: 'answer', correct, now: NOW },
  ].reduce(
    (s, a) => sessionReducer(s, a as Parameters<typeof sessionReducer>[1]),
    startSession('s1', items, NOW - 4000, { mode, day }),
  );
}

describe('commitPending when the question is no longer served', () => {
  it('still logs the answer from the answer record and updates the card', async () => {
    const { storage, services } = setup();
    const data = await loadLearningData(services, new Map([[live.id, live]]));
    const session = pausedOn('retired-1', true, learningDay(NOW, 0));
    await commitPending(services, data, session);

    const log = await storage.listReviews();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      cardId: 'retired-1',
      type: 'mcq',
      mode: 'scheduled',
      correct: true,
      rating: 'good',
      ts: NOW,
      responseMs: 4000,
    });
    expect(log[0]?.schedulerStateAfter).not.toBeNull();
    // The cards cache is what replay derives from the log.
    expect(await storage.get('cards', 'retired-1')).toEqual(
      replayCards(log, data.scheduler).get('retired-1'),
    );
    expect(data.events).toHaveLength(1);
  });

  it('logs wrong answers as Again and keeps practice answers out of FSRS', async () => {
    const { storage, services } = setup();
    const data = await loadLearningData(services, new Map());
    await commitPending(services, data, pausedOn('retired-2', false, 1));
    await commitPending(services, data, pausedOn('retired-3', true, 1, 'extra'));
    const log = await storage.listReviews();
    expect(log.map((e) => [e.cardId, e.rating, e.mode])).toEqual([
      ['retired-2', 'again', 'scheduled'],
      ['retired-3', 'good', 'extra'],
    ]);
    expect(log[1]?.schedulerStateAfter).toBeNull();
  });

  it('does not log a recall answer that was shown but never rated', async () => {
    const { storage, services } = setup();
    const data = await loadLearningData(services, new Map());
    const items = [{ questionId: 'retired-4', layout: [] }];
    const shown = [
      { type: 'respond', response: { type: 'recall' } },
      { type: 'answer', correct: false, now: NOW },
    ].reduce(
      (s, a) => sessionReducer(s, a as Parameters<typeof sessionReducer>[1]),
      startSession('s1', items, NOW - 1000, { mode: 'scheduled', day: 1 }),
    );
    await commitPending(services, data, shown);
    expect(await storage.listReviews()).toEqual([]);
  });
});

describe('loadResumableSession', () => {
  it('closes a saved session whose questions were retired and keeps its pending answer', async () => {
    const { storage, services } = setup();
    const data = await loadLearningData(services, new Map([[live.id, live]]));
    await storage.put('meta', 'activeSession', pausedOn('retired-1', true, learningDay(NOW, 0)));
    expect(await loadResumableSession(services, data)).toBeUndefined();
    expect((await storage.listReviews()).map((e) => e.cardId)).toEqual(['retired-1']);
    expect(await storage.get('meta', 'activeSession')).toBeUndefined();
  });

  it('still resumes a same-day session whose questions are all served', async () => {
    const { storage, services } = setup();
    const data = await loadLearningData(services, new Map([[live.id, live]]));
    const saved = startSession('s1', [{ questionId: live.id, layout: [0, 1, 2, 3] }], NOW - 1000, {
      mode: 'scheduled',
      day: learningDay(NOW, 0),
    });
    await storage.put('meta', 'activeSession', saved);
    const resumed = await loadResumableSession(services, data);
    expect(resumed?.id).toBe('s1');
    expect(await storage.listReviews()).toEqual([]);
  });

  it("commits a previous day's pending answer when closing that session", async () => {
    const { storage, services } = setup(NOW + 2 * DAY_MS);
    const data = await loadLearningData(services, new Map([[live.id, live]]));
    await storage.put('meta', 'activeSession', pausedOn(live.id, false, learningDay(NOW, 0)));
    expect(await loadResumableSession(services, data)).toBeUndefined();
    expect((await storage.listReviews()).map((e) => [e.cardId, e.rating])).toEqual([
      [live.id, 'again'],
    ]);
  });

  it('closeSession is safe on a session with nothing pending', async () => {
    const { storage, services } = setup();
    const data = await loadLearningData(services, new Map());
    const fresh = startSession('s', [{ questionId: 'x', layout: [] }], NOW, {
      mode: 'extra',
      day: 1,
    });
    await closeSession(services, data, fresh);
    expect(await storage.listReviews()).toEqual([]);
  });
});

describe('active packs and Practice <Subject>', () => {
  const v = { status: 'verified' as const, verified_on: '2026-02-01' };
  const aQs = Array.from({ length: 4 }, (_, i) => mcq({ id: `a-${i}`, pack: 'a', ...v }));
  const bQs = Array.from({ length: 4 }, (_, i) => mcq({ id: `b-${i}`, pack: 'b', ...v }));
  const indexPack = (id: string): IndexPack => ({
    id,
    title: id,
    description: '',
    version: '1',
    language: 'en',
    license: 'CC-BY-4.0',
    accent: 'gold',
    domainPath: ['d', id],
    bytes: 1,
    file: `packs/${id}.h.json`,
    topics: [],
    counts: emptyCounts(),
  });
  const index: ContentIndex = { version: 3, packs: [indexPack('a'), indexPack('b')], tree: [] };

  function contentSetup(online = true) {
    const { storage, services } = setup();
    const fetched: string[] = [];
    const kept: string[][] = [];
    const content: ContentSource = {
      loadIndex: () => Promise.resolve(index),
      loadPack: (p) => {
        fetched.push(p.id);
        if (!online && p.id === 'b') return Promise.reject(new Error('offline'));
        return Promise.resolve({
          meta: {} as PackContent['meta'],
          questions: p.id === 'a' ? aQs : bQs,
        });
      },
      keepOffline: (files) => {
        kept.push([...files]);
        return Promise.resolve();
      },
    };
    return { storage, services: { ...services, content }, fetched, kept };
  }

  it('loads every pack while activation is unset, and only active ones after', async () => {
    const all = contentSetup();
    const data = await loadActiveLearning(all.services);
    expect(data.activePacks).toEqual(['a', 'b']);
    expect(data.questions.size).toBe(8);

    const one = contentSetup();
    await one.storage.put('settings', 'learning', { activePacks: ['a'] });
    const onlyA = await loadActiveLearning(one.services);
    expect(one.fetched).toEqual(['a']);
    expect([...onlyA.questions.keys()].every((id) => id.startsWith('a-'))).toBe(true);
    expect(one.kept).toEqual([['packs/a.h.json']]);
  });

  it('starts a scheduled session of the subject only, activating its pack', async () => {
    const { storage, services } = contentSetup();
    await storage.put('settings', 'learning', { activePacks: ['a'] });
    const data = await loadActiveLearning(services);
    const session = await startSubjectSession(services, data, {
      packs: ['b'],
      questionIds: bQs.map((q) => q.id),
    });
    expect(session.mode).toBe('scheduled');
    expect(session.items.map((i) => i.questionId).sort()).toEqual(bQs.map((q) => q.id));
    expect(await loadSettings(services)).toMatchObject({ activePacks: ['a', 'b'] });
    expect(await storage.get('meta', 'activeSession')).toEqual(session);
  });

  it('falls back to extra practice when nothing of the subject is due or new', async () => {
    const { storage, services } = contentSetup();
    await storage.put('settings', 'learning', { newPerDay: 0 });
    const data = await loadActiveLearning(services);
    const session = await startSubjectSession(services, data, {
      packs: ['a'],
      questionIds: aQs.map((q) => q.id),
    });
    expect(session.mode).toBe('extra');
    expect(session.items.every((i) => i.questionId.startsWith('a-'))).toBe(true);
  });

  it('changes nothing when the pack cannot be fetched', async () => {
    const { storage, services } = contentSetup(false);
    await storage.put('settings', 'learning', { activePacks: ['a'] });
    const data = await loadActiveLearning(services);
    await expect(
      startSubjectSession(services, data, { packs: ['b'], questionIds: ['b-0'] }),
    ).rejects.toThrow();
    expect((await loadSettings(services)).activePacks).toEqual(['a']);
    expect(await storage.get('meta', 'activeSession')).toBeUndefined();
  });

  it('turns a subject off and on', async () => {
    const { services } = contentSetup();
    await setPacksActive(services, index, ['a'], false);
    expect((await loadSettings(services)).activePacks).toEqual(['b']);
    await setPacksActive(services, index, ['a'], true);
    expect((await loadSettings(services)).activePacks).toEqual(['a', 'b']);
  });
});

describe('startDrillSession', () => {
  it('starts extra practice with the given questions that are served', async () => {
    const { storage, services } = setup();
    const data = await loadLearningData(services, new Map([[live.id, live]]));
    const session = await startDrillSession(services, data, [live.id, 'not-served']);
    expect(session.mode).toBe('extra');
    expect(session.items.map((i) => i.questionId)).toEqual([live.id]);
    expect(await storage.get('meta', 'activeSession')).toEqual(session);
  });
});
