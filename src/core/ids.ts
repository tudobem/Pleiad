/** Unique ID source (UUIDs on web). Injected so tests can be deterministic. */
export interface IdGenerator {
  newId(): string;
}

/** Predictable IDs for tests: prefix-1, prefix-2, ... */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return { newId: () => `${prefix}-${(n += 1)}` };
}
