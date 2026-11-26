import type { ContentIndex } from '../../core/content/contentIndex.ts';
import type { ContentSource, PackContent } from '../../core/content/source.ts';

/** Cache that holds active pack files; the service worker serves it (vite.config.ts). */
export const PACK_CACHE = 'pleiad-packs';

/**
 * Loads generated content (scripts/build-content-index.ts) from the same
 * origin. Content is validated in CI, so it is trusted here.
 */
export function fetchContentSource(baseUrl: string): ContentSource {
  // Absolute URLs, so they compare equal to Cache Storage keys.
  const url = (path: string) => new URL(`${baseUrl}content/${path}`, location.href).href;
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(url(path));
    if (!res.ok) throw new Error(`Could not load content/${path} (${res.status})`);
    return (await res.json()) as T;
  };
  return {
    loadIndex: () => get<ContentIndex>('content-index.json'),
    loadPack: (pack) => get<PackContent>(pack.file),
    keepOffline: async (files) => {
      if (typeof caches === 'undefined') return;
      try {
        const cache = await caches.open(PACK_CACHE);
        const wanted = new Set(files.map(url));
        for (const request of await cache.keys()) {
          if (!wanted.has(request.url)) await cache.delete(request);
        }
        for (const href of wanted) {
          if (!(await cache.match(href))) await cache.add(href);
        }
      } catch {
        // Offline or storage refused: packs still load from the network later.
      }
    },
  };
}
