import { openDB, type IDBPDatabase } from 'idb';
import type { StorageAdapter, StoreName } from '../../core/storage.ts';
import type { PleiadDB, StoredReview } from './schema.ts';
import { assertMigrationsOrdered, MIGRATIONS, type Migration } from './migrations.ts';

export const DB_NAME = 'pleiad';

export async function openPleiadDb(
  name = DB_NAME,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<IDBPDatabase<PleiadDB>> {
  assertMigrationsOrdered(migrations);
  return openDB<PleiadDB>(name, migrations.length, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      for (const m of migrations) {
        if (m.version > oldVersion) await m.up(db, tx);
      }
    },
  });
}

/** StorageAdapter backed by IndexedDB (SPEC 3.2, 19). */
export async function indexedDbStorage(
  name = DB_NAME,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<StorageAdapter & { close(): void }> {
  const db = await openPleiadDb(name, migrations);

  return {
    get: async <T>(store: StoreName, key: string) => (await db.get(store, key)) as T | undefined,
    put: async (store, key, value) => {
      await db.put(store, value, key);
    },
    delete: async (store, key) => {
      await db.delete(store, key);
    },
    getAll: async <T>(store: StoreName) => (await db.getAll(store)) as T[],
    async appendReview(event) {
      const tx = db.transaction('reviews', 'readwrite');
      const done = tx.done;
      try {
        const last = await tx.store.index('by-seq').openCursor(null, 'prev');
        const seq = (last?.value.seq ?? 0) + 1;
        // add() rejects if the eventId already exists: the log is append-only.
        await tx.store.add({ ...event, seq });
        await done;
      } catch (error) {
        // The aborted transaction also rejects `done`; report the add error once.
        done.catch(() => undefined);
        throw error;
      }
    },
    async listReviews() {
      const rows = await db.getAllFromIndex('reviews', 'by-seq');
      return rows.map(({ seq: _seq, ...event }: StoredReview) => event);
    },
    async clear() {
      const names = ['cards', 'settings', 'notes', 'flags', 'meta', 'reviews'] as const;
      const tx = db.transaction([...names], 'readwrite');
      await Promise.all([...names.map((n) => tx.objectStore(n).clear()), tx.done]);
    },
    close: () => db.close(),
  };
}
