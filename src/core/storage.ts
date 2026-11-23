import type { ReviewEvent } from './sync/reviewEvent.ts';

/**
 * All persistence goes through a StorageAdapter (SPEC 3.2). Core declares the
 * interface; platform implements it (IndexedDB in M2, SQLite on native later).
 * Provisional in M0: the shape may be refined when the first implementation
 * lands, but the rules stay: reviews are append-only, everything is async.
 */

/** Mutable key-value stores. `reviews` is separate because it is append-only. */
export type StoreName = 'cards' | 'settings' | 'notes' | 'flags' | 'meta';

export interface StorageAdapter {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  getAll<T>(store: StoreName): Promise<T[]>;

  /** Append one event. Rejects if an event with the same eventId exists. */
  appendReview(event: ReviewEvent): Promise<void>;
  /** All events in insertion order. */
  listReviews(): Promise<ReviewEvent[]>;

  /** Remove everything (used by "Replace" import and tests). */
  clear(): Promise<void>;
}
