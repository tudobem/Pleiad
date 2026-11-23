import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { indexedDbStorage, openPleiadDb } from './indexedDbStorage.ts';
import { MIGRATIONS, type Migration } from './migrations.ts';
import { reviewEvent, storageContract } from '../../core/storageContract.test-util.ts';

let n = 0;
const freshName = () => `pleiad-test-${(n += 1)}`;

storageContract('IndexedDB', () => indexedDbStorage(freshName()));

describe('IndexedDB adapter', () => {
  it('keeps data across reopen', async () => {
    const name = freshName();
    const a = await indexedDbStorage(name);
    await a.put('meta', 'deviceId', 'd-1');
    await a.appendReview(reviewEvent({ eventId: 'x' }));
    a.close();
    const b = await indexedDbStorage(name);
    expect(await b.get('meta', 'deviceId')).toBe('d-1');
    expect((await b.listReviews()).map((e) => e.eventId)).toEqual(['x']);
    expect((await b.listReviews())[0]).not.toHaveProperty('seq');
    b.close();
  });

  it('runs only new migrations on upgrade and keeps existing data', async () => {
    const name = freshName();
    const v1 = await indexedDbStorage(name);
    await v1.put('settings', 'dailyGoal', 20);
    await v1.appendReview(reviewEvent({ eventId: 'keep' }));
    v1.close();

    const ran: number[] = [];
    const v2: Migration = {
      version: 2,
      description: 'test: double the goal',
      async up(_db, tx) {
        ran.push(2);
        const store = tx.objectStore('settings');
        const goal = (await store.get('dailyGoal')) as number;
        await store.put(goal * 2, 'dailyGoal');
      },
    };
    const upgraded = await indexedDbStorage(name, [...MIGRATIONS, v2]);
    expect(ran).toEqual([2]);
    expect(await upgraded.get('settings', 'dailyGoal')).toBe(40);
    expect((await upgraded.listReviews()).map((e) => e.eventId)).toEqual(['keep']);
    upgraded.close();

    const db = await openPleiadDb(name, [...MIGRATIONS, v2]);
    expect(db.version).toBe(2);
    db.close();
  });

  it('rejects misnumbered migrations', async () => {
    const bad: Migration = { version: 3, description: 'gap', up() {} };
    await expect(indexedDbStorage(freshName(), [...MIGRATIONS, bad])).rejects.toThrow(/expected 2/);
  });
});
