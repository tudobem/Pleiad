import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IndexPack } from '../../core/content/contentIndex.ts';
import { fetchContentSource, PACK_CACHE } from './fetchContent.ts';

const ORIGIN = 'https://example.test';

function fakeCache(initial: string[]) {
  const entries = new Set(initial);
  return {
    entries,
    keys: () => Promise.resolve([...entries].map((url) => ({ url }))),
    delete: (req: { url: string }) => Promise.resolve(entries.delete(req.url)),
    match: (url: string) => Promise.resolve(entries.has(url) ? {} : undefined),
    add: (url: string) => {
      entries.add(url);
      return Promise.resolve();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchContentSource', () => {
  it('fetches a pack by its hashed file name', async () => {
    vi.stubGlobal('location', { href: `${ORIGIN}/app/` });
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ questions: [] }) }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const source = fetchContentSource('/app/');
    await source.loadPack({ id: 'p', file: 'packs/p.abc.json' } as IndexPack);
    expect(fetchMock).toHaveBeenCalledWith(`${ORIGIN}/app/content/packs/p.abc.json`);
  });

  it('keeps exactly the active pack files in the pack cache', async () => {
    vi.stubGlobal('location', { href: `${ORIGIN}/app/` });
    const cache = fakeCache([
      `${ORIGIN}/app/content/packs/p.old.json`,
      `${ORIGIN}/app/content/packs/q.abc.json`,
    ]);
    const open = vi.fn(() => Promise.resolve(cache));
    vi.stubGlobal('caches', { open });
    await fetchContentSource('/app/').keepOffline(['packs/p.new.json', 'packs/q.abc.json']);
    expect(open).toHaveBeenCalledWith(PACK_CACHE);
    expect([...cache.entries].sort()).toEqual([
      `${ORIGIN}/app/content/packs/p.new.json`,
      `${ORIGIN}/app/content/packs/q.abc.json`,
    ]);
  });

  it('never throws when caching fails', async () => {
    vi.stubGlobal('location', { href: `${ORIGIN}/app/` });
    vi.stubGlobal('caches', { open: () => Promise.reject(new Error('quota')) });
    await expect(fetchContentSource('/app/').keepOffline(['packs/p.json'])).resolves.toBe(
      undefined,
    );
  });
});
