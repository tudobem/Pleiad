import type { IdGenerator } from '../core/ids.ts';
import type { StorageAdapter } from '../core/storage.ts';

export interface Identity {
  readonly deviceId: string;
  readonly profileId: string;
}

/**
 * Device and profile IDs live in the meta store. They are created on first
 * run and never change afterwards (SPEC 3.3; one profile for now, SPEC 1).
 */
export async function loadIdentity(storage: StorageAdapter, ids: IdGenerator): Promise<Identity> {
  const read = async (key: string): Promise<string> => {
    const existing = await storage.get<string>('meta', key);
    if (typeof existing === 'string' && existing.length > 0) return existing;
    const created = ids.newId();
    await storage.put('meta', key, created);
    return created;
  };
  return { deviceId: await read('deviceId'), profileId: await read('profileId') };
}
