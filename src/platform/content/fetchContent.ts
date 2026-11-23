import type { ContentIndex } from '../../core/content/contentIndex.ts';
import type { ContentSource, PackContent } from '../../core/content/source.ts';

/**
 * Loads generated content (scripts/build-content-index.ts) from the same
 * origin. Content is validated in CI, so it is trusted here.
 */
export function fetchContentSource(baseUrl: string): ContentSource {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${baseUrl}content/${path}`);
    if (!res.ok) throw new Error(`Could not load content/${path} (${res.status})`);
    return (await res.json()) as T;
  };
  return {
    loadIndex: () => get<ContentIndex>('content-index.json'),
    loadPack: (packId) => get<PackContent>(`packs/${encodeURIComponent(packId)}.json`),
  };
}
