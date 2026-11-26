import { STORE_NAMES, type StorageAdapter, type StorageSnapshot } from '../storage.ts';

/** Read the whole database as plain data (for export and restore planning). */
export async function readSnapshot(storage: StorageAdapter): Promise<StorageSnapshot> {
  const [reviews, cards, settings, notes, flags, meta] = await Promise.all([
    storage.listReviews(),
    ...STORE_NAMES.map((n) => storage.entries(n)),
  ]);
  return {
    reviews: reviews as StorageSnapshot['reviews'],
    stores: {
      cards: cards as [string, unknown][],
      settings: settings as [string, unknown][],
      notes: notes as [string, unknown][],
      flags: flags as [string, unknown][],
      meta: meta as [string, unknown][],
    },
  };
}
