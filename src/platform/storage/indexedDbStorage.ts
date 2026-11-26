import { openDB, type IDBPDatabase } from 'idb';
import { STORE_NAMES, type StorageAdapter, type StoreName } from '../../core/storage.ts';
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
    async entries(store) {
      const out: [string, unknown][] = [];
      let cursor = await db.transaction(store).store.openCursor();
      while (cursor) {
        out.push([String(cursor.key), cursor.value]);
        cursor = await cursor.continue();
      }
      return out;
    },
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
    async replaceAll(snapshot) {
      const names = [...STORE_NAMES, 'reviews'] as const;
      const tx = db.transaction([...names], 'readwrite');
      const done = tx.done;
      try {
        for (const name of names) await tx.objectStore(name).clear();
        for (const name of STORE_NAMES) {
          const store = tx.objectStore(name);
          for (const [key, value] of snapshot.stores[name]) await store.put(value, key);
        }
        const reviews = tx.objectStore('reviews');
        let seq = 0;
        // add() rejects a duplicate eventId, which aborts the whole transaction.
        for (const event of snapshot.reviews) await reviews.add({ ...event, seq: (seq += 1) });
        await done;
      } catch (error) {
        done.catch(() => undefined);
        try {
          tx.abort();
        } catch {
          // Already aborted by the failed request.
        }
        throw error;
      }
    },
    close: () => db.close(),
  };
}
