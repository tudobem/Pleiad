import type { StorageAdapter, StoreName } from './storage.ts';
import type { ReviewEvent } from './sync/reviewEvent.ts';

/**
 * In-memory StorageAdapter. Used in tests and as the reference
 * implementation for the storage contract. Values are deep-copied so callers
 * cannot mutate stored data, similar to IndexedDB cloning.
 */
export function memoryStorage(): StorageAdapter {
  const stores = new Map<StoreName, Map<string, unknown>>();
  const reviews: ReviewEvent[] = [];
  const store = (name: StoreName) => {
    let s = stores.get(name);
    if (!s) {
      s = new Map();
      stores.set(name, s);
    }
    return s;
  };
  // Stored data is plain JSON; copying keeps callers from mutating it.
  const copy = <T>(value: T): T =>
    value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

  return {
    get: async <T>(name: StoreName, key: string) => {
      const s = store(name);
      return s.has(key) ? copy(s.get(key) as T) : undefined;
    },
    put: async (name, key, value) => {
      store(name).set(key, copy(value));
    },
    delete: async (name, key) => {
      store(name).delete(key);
    },
    getAll: async <T>(name: StoreName) => [...store(name).values()].map((v) => copy(v as T)),
    appendReview: async (event) => {
      if (reviews.some((e) => e.eventId === event.eventId)) {
        throw new Error(`Duplicate review eventId ${event.eventId}`);
      }
      reviews.push(copy(event));
    },
    listReviews: async () => reviews.map(copy),
    clear: async () => {
      stores.clear();
      reviews.length = 0;
    },
  };
}
