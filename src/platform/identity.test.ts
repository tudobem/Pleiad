import { describe, expect, it } from 'vitest';
import { loadIdentity } from './identity.ts';
import { memoryStorage } from '../core/memoryStorage.ts';
import { sequentialIds } from '../core/ids.ts';

describe('loadIdentity', () => {
  it('creates IDs once and reuses them', async () => {
    const storage = memoryStorage();
    const first = await loadIdentity(storage, sequentialIds('x'));
    expect(first).toEqual({ deviceId: 'x-1', profileId: 'x-2' });
    expect(await loadIdentity(storage, sequentialIds('y'))).toEqual(first);
  });
});
