import { useEffect, useState } from 'preact/hooks';
import type { ContentSource } from '../core/content/source.ts';
import type { McqQuestion } from '../core/content/types.ts';
import { sessionEligible } from '../core/session/session.ts';
import { useServices } from './services.ts';

export type Loadable<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly value: T };

const cache = new WeakMap<ContentSource, Promise<Map<string, McqQuestion>>>();

/** All questions the practice session can use, keyed by ID. Cached per source. */
export function loadEligibleQuestions(content: ContentSource): Promise<Map<string, McqQuestion>> {
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

export function useEligibleQuestions(): Loadable<Map<string, McqQuestion>> {
  const { content } = useServices();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Loadable<Map<string, McqQuestion>>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadEligibleQuestions(content).then(
      (value) => alive && setState({ status: 'ready', value }),
      () => alive && setState({ status: 'error', retry: () => setAttempt((n) => n + 1) }),
    );
    return () => {
      alive = false;
    };
  }, [content, attempt]);
  return state;
}
