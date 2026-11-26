import type { ContentSource } from '../core/content/source.ts';
import type { Question } from '../core/content/types.ts';
import { sessionEligible } from '../core/session/session.ts';

export type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly value: T };

const cache = new WeakMap<ContentSource, Promise<Map<string, Question>>>();

/** All questions the practice session can use, keyed by ID. Cached per source. */
export function loadEligibleQuestions(content: ContentSource): Promise<Map<string, Question>> {
  let pending = cache.get(content);
  if (!pending) {
    pending = (async () => {
      const index = await content.loadIndex();
      const packs = await Promise.all(index.packs.map((p) => content.loadPack(p.id)));
      return new Map(sessionEligible(packs.flatMap((p) => p.questions)).map((q) => [q.id, q]));
    })();
    pending.catch(() => cache.delete(content));
    cache.set(content, pending);
  }
  return pending;
}
