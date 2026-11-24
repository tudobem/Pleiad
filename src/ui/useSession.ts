import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { McqQuestion } from '../core/content/types.ts';
import { previewDue } from '../core/session/commit.ts';
import {
  currentItem,
  pendingAnswer,
  sessionReducer,
  type SessionAction,
  type SessionState,
} from '../core/session/reducer.ts';
import { gradeMcq } from '../core/session/session.ts';
import { commitPending, saveSession, type LearningData } from './learning.ts';
import { useServices } from './services.ts';

export interface SessionController {
  readonly state: SessionState;
  readonly question: McqQuestion | undefined;
  readonly lastAnswerCorrect: boolean | undefined;
  /** For scheduled sessions on the feedback screen: when the card will be due next. */
  readonly nextDue: number | null;
  readonly busy: boolean;
  /** Set when a review could not be saved. */
  readonly saveFailed: boolean;
  select(displayIndex: number): void;
  check(): void;
  /** Leave the feedback screen; `tooEasy` rates a correct answer Easy (SPEC 7.3). */
  next(tooEasy?: boolean): void;
}

export function useSession(initial: SessionState, data: LearningData): SessionController {
  const services = useServices();
  const [state, setState] = useState(initial);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const busyRef = useRef(false);

  const dispatch = useCallback((action: SessionAction) => {
    setState((s) => sessionReducer(s, action));
  }, []);

  useEffect(() => {
    saveSession(services, state).catch(() => setSaveFailed(true));
  }, [services, state]);

  const item = currentItem(state);
  const question = item ? data.questions.get(item.questionId) : undefined;
  const pending = pendingAnswer(state);

  const check = useCallback(() => {
    const s = stateRef.current;
    const it = currentItem(s);
    const q = it ? data.questions.get(it.questionId) : undefined;
    if (s.phase !== 'question' || s.selected === null || !it || !q) return;
    const { correct } = gradeMcq(q, it, s.selected);
    dispatch({ type: 'answer', correct, now: services.clock.now() });
  }, [data, dispatch, services]);

  const next = useCallback(
    (tooEasy = false) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      // The review event is written before moving on (append-only log first).
      commitPending(services, data, stateRef.current, tooEasy)
        .catch(() => setSaveFailed(true))
        .finally(() => {
          dispatch({ type: 'continue', now: services.clock.now(), tooEasy });
          busyRef.current = false;
          setBusy(false);
        });
    },
    [data, dispatch, services],
  );

  const nextDue =
    pending && question
      ? previewDue({
          question,
          answer: pending,
          mode: state.mode,
          card: data.cards.get(question.id),
          scheduler: data.scheduler,
          thresholds: data.thresholds,
        })
      : null;

  return {
    state,
    question,
    lastAnswerCorrect: pending?.correct,
    nextDue,
    busy,
    saveFailed,
    select: (displayIndex) => dispatch({ type: 'select', displayIndex }),
    check,
    next,
  };
}
