import { describe, expect, it } from 'vitest';
import { fixedClock } from '../core/clock.ts';
import type { Device } from '../core/device.ts';
import { sequentialIds } from '../core/ids.ts';
import { memoryStorage } from '../core/memoryStorage.ts';
import { seededRandom } from '../core/random.ts';
import { DAY_MS } from '../core/scheduler/day.ts';
import { reviewEvent } from '../core/storageContract.test-util.ts';
import {
  currentNotice,
  exportBackup,
  importBackup,
  LAST_BACKUP_KEY,
  TAB_NOTICE_KEY,
} from './backup.ts';
import type { Services } from './services.ts';

const NOW = Date.UTC(2026, 10, 26, 12);

function setup(opts: { standalone?: boolean; usage?: number } = {}) {
  const storage = memoryStorage();
  const saved: { name: string; text: string }[] = [];
  let usage = opts.usage ?? 0;
  const device: Device = {
    saveFile: (name, text) => {
      saved.push({ name, text });
      return Promise.resolve('downloaded');
    },
    isStandalone: () => opts.standalone ?? true,
    readUsage: () => usage,
    writeUsage: (n) => {
      usage = n;
    },
    reload: () => undefined,
  };
  const services: Services = {
    storage,
    content: {
      loadIndex: () => Promise.reject(new Error('unused')),
      loadPack: () => Promise.reject(new Error('unused')),
      keepOffline: () => Promise.resolve(),
    },
    clock: fixedClock(NOW),
    random: seededRandom(1),
    ids: sequentialIds('id'),
    identity: { deviceId: 'd', profileId: 'p' },
    appVersion: 'test',
    persistent: true,
    device,
  };
  return { storage, services, saved, usage: () => usage };
}

describe('exportBackup and importBackup', () => {
  it('exports a dated file, records the time and restores it', async () => {
    const { storage, services, saved } = setup();
    await storage.appendReview(reviewEvent({ eventId: 'a', cardId: 'q1', mode: 'scheduled' }));
    const out = await exportBackup(services);
    expect(out).toEqual({ result: 'downloaded', answers: 1 });
    expect(saved[0]?.name).toBe('pleiad-backup-2026-11-26.json');
    expect(await storage.get('meta', LAST_BACKUP_KEY)).toBe(NOW);

    const fresh = setup();
    const result = await importBackup(fresh.services, saved[0]?.text ?? '', 'replace');
    expect(result).toMatchObject({ ok: true, summary: { added: 1, total: 1 } });
    expect((await fresh.storage.listReviews()).map((e) => e.eventId)).toEqual(['a']);
    expect(await fresh.storage.get('cards', 'q1')).toBeTruthy();
    expect(fresh.usage()).toBe(1);
  });

  it('changes nothing for an invalid file', async () => {
    const { storage, services } = setup();
    await storage.appendReview(reviewEvent({ eventId: 'keep' }));
    expect(await importBackup(services, '{"format":"pleiad-backup"}', 'replace')).toMatchObject({
      ok: false,
      error: 'not-a-backup',
    });
    expect((await storage.listReviews()).map((e) => e.eventId)).toEqual(['keep']);
  });
});

describe('currentNotice', () => {
  const first = NOW - 20 * DAY_MS;

  it('puts data loss first, then the browser-tab warning, then the reminder', async () => {
    expect(await currentNotice(setup({ usage: 5 }).services, 0, undefined)).toBe('data-loss');

    const tab = setup({ standalone: false });
    expect(await currentNotice(tab.services, 3, first)).toBe('browser-tab');
    await tab.storage.put('meta', TAB_NOTICE_KEY, true);
    expect(await currentNotice(tab.services, 3, first)).toBe('backup-due');

    const app = setup();
    await app.storage.put('meta', LAST_BACKUP_KEY, NOW - DAY_MS);
    expect(await currentNotice(app.services, 3, first)).toBeUndefined();
    expect(await currentNotice(setup().services, 0, undefined)).toBeUndefined();
  });

  it('records usage so a later wipe can be noticed', async () => {
    const s = setup();
    await currentNotice(s.services, 4, first);
    expect(s.usage()).toBe(4);
  });
});
