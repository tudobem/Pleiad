import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { PleiadDB } from './schema.ts';

/**
 * Ordered schema migrations. The database version is the number of
 * migrations; opening runs every migration above the stored version, in
 * order, inside the upgrade transaction. Never edit a shipped migration:
 * append a new one.
 */
export interface Migration {
  readonly version: number;
  readonly description: string;
  up(
    db: IDBPDatabase<PleiadDB>,
    tx: IDBPTransaction<PleiadDB, StoreNames<PleiadDB>[], 'versionchange'>,
  ): void | Promise<void>;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial stores: cards, reviews (event log), settings, notes, flags, meta',
    up(db) {
      for (const name of ['cards', 'settings', 'notes', 'flags', 'meta'] as const) {
        db.createObjectStore(name);
      }
      const reviews = db.createObjectStore('reviews', { keyPath: 'eventId' });
      reviews.createIndex('by-ts', 'ts');
      reviews.createIndex('by-card', 'cardId');
      // Insertion order for listReviews, independent of eventId sort order.
      reviews.createIndex('by-seq', 'seq', { unique: true });
    },
  },
];

export function assertMigrationsOrdered(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(`Migration at position ${i} has version ${m.version}; expected ${i + 1}.`);
    }
  });
}
