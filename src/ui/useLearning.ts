import { useEffect, useState } from 'preact/hooks';
import type { SessionState } from '../core/session/reducer.ts';
import { loadActiveLearning, loadResumableSession, type LearningData } from './learning.ts';
import { useServices } from './services.ts';
import type { Loadable } from './useContent.ts';

export interface Learning {
  readonly data: LearningData;
  /** Same-day session that can be resumed. */
  readonly saved: SessionState | undefined;
}

/** Content, the replayed log and any resumable session, reloaded on demand. */
export function useLearning(): Loadable<Learning> & { reload: () => void } {
  const services = useServices();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Loadable<Learning>>({ status: 'loading' });
  const reload = () => setAttempt((n) => n + 1);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    (async () => {
      const data = await loadActiveLearning(services);
      const saved = await loadResumableSession(services, data);
      return { data, saved };
    })().then(
      (value) => alive && setState({ status: 'ready', value }),
      () => alive && setState({ status: 'error', retry: reload }),
    );
    return () => {
      alive = false;
    };
  }, [services, attempt]);

  return { ...state, reload };
}
