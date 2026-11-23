import type { SessionState } from '../core/session/reducer.ts';
import type { StorageAdapter } from '../core/storage.ts';

/** The in-progress session is saved in the meta store so it survives app suspension (SPEC 8). */
const KEY = 'activeSession';

export async function loadSavedSession(storage: StorageAdapter): Promise<SessionState | undefined> {
  const saved = await storage.get<SessionState>('meta', KEY);
  return saved && saved.phase !== 'done' ? saved : undefined;
}

export function saveSession(storage: StorageAdapter, state: SessionState): Promise<void> {
  return state.phase === 'done' ? storage.delete('meta', KEY) : storage.put('meta', KEY, state);
}

export function discardSession(storage: StorageAdapter): Promise<void> {
  return storage.delete('meta', KEY);
}
