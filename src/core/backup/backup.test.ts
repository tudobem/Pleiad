import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../memoryStorage.ts';
import { DAY_MS } from '../scheduler/day.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import type { StorageAdapter } from '../storage.ts';
import { reviewEvent } from '../storageContract.test-util.ts';
import { compareEvents, replayCards } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { BACKUP_MAX_BYTES, buildBackup, parseBackup, type Backup } from './format.ts';
import { backupDue } from './reminder.ts';
import { readSnapshot } from './snapshot.ts';
import { planMerge, planReplace } from './restore.ts';

const T0 = Date.UTC(2026, 10, 1, 12);
const ev = (id: string, cardId: string, days: number, extra: Partial<ReviewEvent> = {}) =>
  reviewEvent({ eventId: id, cardId, ts: T0 + days * DAY_MS, mode: 'scheduled', ...extra });

const snapshotOf = readSnapshot;

const meta = { exportedAt: T0 + 10 * DAY_MS, appVersion: '0.1.0', profileId: 'p-home' };
const emptyStores = { cards: [], settings: [], notes: [], flags: [], meta: [] };

async function seeded(): Promise<StorageAdapter> {
  const s = memoryStorage();
  for (const e of [
    ev('e1', 'q1', 0),
    ev('e2', 'q2', 0, { correct: false, rating: 'again' }),
    ev('e3', 'q1', 3),
  ]) {
    await s.appendReview(e);
  }
  await s.put('settings', 'learning', { newPerDay: 7, desiredRetention: 0.85 });
  await s.put('notes', 'q1', 'remember Tononi');
  await s.put('meta', 'deviceId', 'd-home');
  await s.put('meta', 'profileId', 'p-home');
  await s.put('meta', 'activeSession', { id: 's' });
  return s;
}

describe('backup format', () => {
  it('round-trips through JSON', async () => {
    const backup = buildBackup(await snapshotOf(await seeded()), meta);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed).toEqual({ ok: true, backup });
    expect(backup).not.toHaveProperty('cards');
    expect(backup.notes).toEqual({ q1: 'remember Tononi' });
  });

  it.each([
    ['{', 'not-json'],
    ['[]', 'not-a-backup'],
    ['{"format":"other","schema_version":1}', 'not-a-backup'],
    ['{"format":"pleiad-backup","schema_version":99,"reviews":[]}', 'newer-version'],
    ['{"format":"pleiad-backup","schema_version":1,"profileId":"p"}', 'invalid-content'],
  ])('rejects %s', (text, error) => {
    expect(parseBackup(text)).toMatchObject({ ok: false, error });
  });

  it('rejects the whole file when one answer is invalid or duplicated', () => {
    const base = { format: 'pleiad-backup', schema_version: 1, profileId: 'p' };
    const bad = { ...ev('x', 'q', 0), rating: 'perfect' };
    expect(parseBackup(JSON.stringify({ ...base, reviews: [ev('a', 'q', 0), bad] }))).toMatchObject(
      { ok: false, error: 'invalid-content', detail: 'answer 2: unknown rating' },
    );
    const dup = [ev('a', 'q', 0), ev('a', 'q', 1)];
    expect(parseBackup(JSON.stringify({ ...base, reviews: dup }))).toMatchObject({
      ok: false,
      detail: 'answer 2: duplicate eventId',
    });
  });

  it('refuses oversize files before parsing', () => {
    expect(parseBackup(' '.repeat(BACKUP_MAX_BYTES + 1))).toMatchObject({ error: 'too-large' });
  });
});

describe('planReplace', () => {
  it('takes the backup, keeps this device ID and rebuilds cards by replay', async () => {
    const backup = buildBackup(await snapshotOf(await seeded()), meta);
    const other = memoryStorage();
    await other.appendReview(ev('local', 'q9', 1));
    await other.put('meta', 'deviceId', 'd-phone');
    await other.put('meta', 'profileId', 'p-phone');
    await other.put('meta', 'activeSession', { id: 'old' });

    const { snapshot, summary } = planReplace(await snapshotOf(other), backup);
    expect(snapshot.reviews.map((e) => e.eventId)).toEqual(['e1', 'e2', 'e3']);
    expect(Object.fromEntries(snapshot.stores.meta)).toEqual({
      deviceId: 'd-phone',
      profileId: 'p-home',
    });
    expect(Object.fromEntries(snapshot.stores.settings)).toEqual(backup.settings);
    const expected = replayCards(snapshot.reviews, fsrsScheduler(0.85));
    expect(new Map(snapshot.stores.cards)).toEqual(expected);
    expect(summary).toMatchObject({ inFile: 3, added: 3, total: 3 });
  });
});

describe('planMerge', () => {
  const backupWith = (reviews: ReviewEvent[], extra: Partial<Backup> = {}): Backup => ({
    format: 'pleiad-backup',
    schema_version: 1,
    exportedAt: 0,
    appVersion: '',
    profileId: 'p-other',
    reviews,
    settings: { learning: { newPerDay: 30 }, extra: true },
    notes: { q1: 'from file', q7: 'only in file' },
    flags: {},
    ...extra,
  });

  it('unions by eventId, keeps local data on conflicts and rebuilds cards', async () => {
    const local = await snapshotOf(await seeded());
    const fileEvents = [
      ev('e1', 'q1', 0),
      ev('e2', 'q2', 0, { correct: true, rating: 'good' }),
      ev('f1', 'q3', 1),
    ];
    const { snapshot, summary } = planMerge(local, backupWith(fileEvents));
    expect(summary).toEqual({ inFile: 3, added: 1, kept: 3, conflicts: 1, total: 4 });
    expect(snapshot.reviews.map((e) => e.eventId)).toEqual(['e1', 'e2', 'f1', 'e3']);
    expect(snapshot.reviews.find((e) => e.eventId === 'e2')?.rating).toBe('again');
    expect([...snapshot.reviews].sort(compareEvents)).toEqual(snapshot.reviews);
    const settings = Object.fromEntries(snapshot.stores.settings);
    expect(settings.learning).toEqual({ newPerDay: 7, desiredRetention: 0.85 });
    expect(settings.extra).toBe(true);
    expect(Object.fromEntries(snapshot.stores.notes)).toEqual({
      q1: 'remember Tononi',
      q7: 'only in file',
    });
    expect(snapshot.stores.meta).toEqual(local.stores.meta);
    expect(new Map(snapshot.stores.cards)).toEqual(
      replayCards(snapshot.reviews, fsrsScheduler(0.85)),
    );
  });

  it('is idempotent', async () => {
    const local = await snapshotOf(await seeded());
    const backup = backupWith([ev('f1', 'q3', 1)]);
    const once = planMerge(local, backup).snapshot;
    const twice = planMerge(once, backup);
    expect(twice.summary).toMatchObject({ added: 0, conflicts: 0 });
    expect(twice.snapshot).toEqual(once);
  });
});

describe('export, wipe and restore', () => {
  it('restores an identical log and cards', async () => {
    const home = await seeded();
    const before = await snapshotOf(home);
    const file = JSON.stringify(buildBackup(before, meta));
    await home.replaceAll({ reviews: [], stores: emptyStores });

    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    await home.replaceAll(planReplace(await snapshotOf(home), parsed.backup).snapshot);
    const after = await snapshotOf(home);
    expect(after.reviews).toEqual([...before.reviews].sort(compareEvents));
    expect(new Map(after.stores.cards)).toEqual(replayCards(before.reviews, fsrsScheduler(0.85)));
    expect(Object.fromEntries(after.stores.settings)).toEqual(
      Object.fromEntries(before.stores.settings),
    );
  });
});

describe('backupDue', () => {
  const now = T0 + 30 * DAY_MS;
  it('waits 7 days after the last export or the first answer', () => {
    expect(backupDue(undefined, undefined, now)).toBe(false);
    expect(backupDue(undefined, now - 8 * DAY_MS, now)).toBe(true);
    expect(backupDue(undefined, now - 6 * DAY_MS, now)).toBe(false);
    expect(backupDue(now - 8 * DAY_MS, now - 20 * DAY_MS, now)).toBe(true);
    expect(backupDue(now - DAY_MS, now - 20 * DAY_MS, now)).toBe(false);
  });
});
