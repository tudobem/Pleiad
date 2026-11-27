import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Question } from '../core/content/types.ts';
import { previewDue } from '../core/session/commit.ts';
import { grade, type Grade } from '../core/session/grading.ts';
import {
  currentItem,
  itemMode,
  pendingAnswer,
  sessionReducer,
  type AnswerRecord,
  type LeaveOptions,
  type SessionAction,
  type SessionState,
} from '../core/session/reducer.ts';
import { emptyResponse, isComplete, type Response } from '../core/session/response.ts';
import type { SessionItem } from '../core/session/session.ts';
import type { Confidence } from '../core/sync/reviewEvent.ts';
import { commitPending, saveSession, type LearningData } from './learning.ts';
import { useServices } from './services.ts';

export interface SessionController {
  readonly state: SessionState;
  readonly item: SessionItem | undefined;
  readonly question: Question | undefined;
  /** Current response (an empty one for the question if nothing entered yet). */
  readonly response: Response | null;
  readonly canCheck: boolean;
  /** On the feedback screen: the pending answer and its per-part grade. */
  readonly pending: AnswerRecord | undefined;
  readonly grade: Grade | undefined;
  readonly busy: boolean;
  /** Set when a review could not be saved. */
  readonly saveFailed: boolean;
  respond(response: Response): void;
  /** Choose or clear the confidence chip (SPEC 9). */
  setConfidence(confidence: Confidence | null): void;
  /** Check an auto-graded answer, or show the answer of a recall item. */
  check(): void;
  /** Short answers: "I was right" / "I was wrong". */
  override(correct: boolean): void;
  /** Leave the feedback screen, committing the review event (SPEC 7.3). */
  next(options?: LeaveOptions): void;
  /** When the card would be due if the user leaves with these options; null in practice mode. */
  nextDue(options?: LeaveOptions): number | null;
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
  const response = question ? (state.response ?? emptyResponse(question)) : null;
  const pending = pendingAnswer(state);
  const pendingGrade =
    pending && question && item ? grade(question, item.layout, pending.response) : undefined;

  const check = useCallback(() => {
    const s = stateRef.current;
    const it = currentItem(s);
    const q = it ? data.questions.get(it.questionId) : undefined;
    if (s.phase !== 'question' || !it || !q) return;
    const r = s.response ?? emptyResponse(q);
    if (!isComplete(q, r)) return;
    if (s.response === null) dispatch({ type: 'respond', response: r });
    const correct = q.type === 'recall' ? false : grade(q, it.layout, r).correct;
    dispatch({ type: 'answer', correct, now: services.clock.now() });
  }, [data, dispatch, services]);

  const next = useCallback(
    (options: LeaveOptions = {}) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      // The review event is written before moving on (append-only log first).
      commitPending(services, data, stateRef.current, options)
        .catch(() => setSaveFailed(true))
        .finally(() => {
          dispatch({ type: 'continue', now: services.clock.now(), ...options });
          busyRef.current = false;
          setBusy(false);
        });
    },
    [data, dispatch, services],
  );

  const nextDue = (options: LeaveOptions = {}): number | null =>
    pending && question
      ? previewDue(
          {
            question,
            answer: pending,
            mode: itemMode(state),
            card: data.cards.get(question.id),
            scheduler: data.scheduler,
            thresholds: data.thresholds,
          },
          options,
        )
      : null;

  return {
    state,
    item,
    question,
    response,
    canCheck: !!question && isComplete(question, response),
    pending,
    grade: pendingGrade,
    busy,
    saveFailed,
    respond: (r) => dispatch({ type: 'respond', response: r }),
    setConfidence: (c) => dispatch({ type: 'confidence', confidence: c }),
    check,
    override: (correct) => dispatch({ type: 'override', correct }),
    next,
    nextDue,
  };
}
