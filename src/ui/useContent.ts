import type { ContentIndex, IndexPack } from '../core/content/contentIndex.ts';
import type { ContentSource, PackContent } from '../core/content/source.ts';
import type { Question } from '../core/content/types.ts';
import { sessionEligible } from '../core/session/session.ts';

export type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly value: T };

const indexes = new WeakMap<ContentSource, Promise<ContentIndex>>();
const packs = new WeakMap<ContentSource, Map<string, Promise<PackContent>>>();

/** The content index (SPEC 5.3), loaded once per source. */
export function loadIndex(content: ContentSource): Promise<ContentIndex> {
  let pending = indexes.get(content);
  if (!pending) {
    pending = content.loadIndex();
    pending.catch(() => indexes.delete(content));
    indexes.set(content, pending);
  }
  return pending;
}

/** One pack's questions, fetched on first use and then shared (keyed by file). */
export function loadPack(content: ContentSource, pack: IndexPack): Promise<PackContent> {
  let cache = packs.get(content);
  if (!cache) {
    cache = new Map();
    packs.set(content, cache);
  }
  let pending = cache.get(pack.file);
  if (!pending) {
    pending = content.loadPack(pack);
    const map = cache;
    pending.catch(() => map.delete(pack.file));
    cache.set(pack.file, pending);
  }
  return pending;
}

export interface ActiveQuestions {
  /** Session-eligible questions of the packs that loaded, keyed by ID. */
  readonly questions: Map<string, Question>;
  /** Active packs that could not be fetched (offline and not cached). */
  readonly unavailable: readonly string[];
}

/** Questions of the given packs only (lazy loading, SPEC 5.3). */
export async function loadQuestions(
  content: ContentSource,
  index: ContentIndex,
  packIds: readonly string[],
): Promise<ActiveQuestions> {
  const wanted = index.packs.filter((p) => packIds.includes(p.id));
  const results = await Promise.allSettled(wanted.map((p) => loadPack(content, p)));
  const loaded: Question[] = [];
  const unavailable: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') loaded.push(...r.value.questions);
    else unavailable.push(wanted[i]?.id ?? '');
  });
  return {
    questions: new Map(sessionEligible(loaded).map((q) => [q.id, q])),
    unavailable,
  };
}

/** Pack files to keep offline for the given active packs. */
export function activeFiles(index: ContentIndex, packIds: readonly string[]): string[] {
  return index.packs.filter((p) => packIds.includes(p.id)).map((p) => p.file);
}
