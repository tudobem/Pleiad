import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { McqQuestion } from '../core/content/types.ts';
import { ratingFor } from '../core/session/rating.ts';
import {
  currentItem,
  sessionReducer,
  startSession,
  type SessionAction,
  type SessionState,
} from '../core/session/reducer.ts';
import { buildSession, gradeMcq } from '../core/session/session.ts';
import { createReviewEvent } from '../core/sync/events.ts';
import { replayCards } from '../core/sync/replay.ts';
import { useServices, type Services } from './services.ts';
import { loadSavedSession, saveSession } from './sessionStore.ts';

export const SESSION_SIZE = 10;

export interface SessionController {
  readonly state: SessionState;
  readonly question: McqQuestion | undefined;
  readonly lastAnswerCorrect: boolean | undefined;
  select(displayIndex: number): void;
  check(): void;
  next(): void;
  /** Set when a review could not be saved. */
  readonly saveFailed: boolean;
}

/** Resume the saved session if it still matches the content, else start a new one. */
export async function openSession(
  services: Services,
  questions: ReadonlyMap<string, McqQuestion>,
): Promise<SessionState> {
  const { storage, clock, random, ids } = services;
  const saved = await loadSavedSession(storage);
  if (saved && saved.items.every((item) => questions.has(item.questionId))) {
    return sessionReducer(saved, { type: 'resume', now: clock.now() });
  }
  const items = buildSession([...questions.values()], { size: SESSION_SIZE, random });
  return startSession(ids.newId(), items, clock.now());
}

/** Append the review event (source of truth), then refresh the card cache by replay. */
async function recordReview(
  services: Services,
  question: McqQuestion,
  correct: boolean,
  responseMs: number,
): Promise<void> {
  const { storage, clock, ids, identity, appVersion } = services;
  const event = createReviewEvent(
    { clock, ids, appVersion, ...identity },
    {
      cardId: question.id,
      // No scheduler yet (M3): practice answers do not change scheduling state.
      mode: 'extra',
      type: question.type,
      correct,
      rating: ratingFor({ correct }),
      responseMs,
    },
  );
  await storage.appendReview(event);
  const forCard = (await storage.listReviews()).filter((e) => e.cardId === question.id);
  const card = replayCards(forCard).get(question.id);
  if (card) await storage.put('cards', question.id, card);
}

export function useSession(
  initial: SessionState,
  questions: ReadonlyMap<string, McqQuestion>,
): SessionController {
  const services = useServices();
  const [state, setState] = useState(initial);
  const [saveFailed, setSaveFailed] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: SessionAction) => {
    setState((s) => sessionReducer(s, action));
  }, []);

  useEffect(() => {
    saveSession(services.storage, state).catch(() => setSaveFailed(true));
  }, [services.storage, state]);

  const item = currentItem(state);
  const question = item ? questions.get(item.questionId) : undefined;
  const lastAnswer =
    state.phase === 'feedback' ? state.answers[state.answers.length - 1] : undefined;

  const check = useCallback(() => {
    const s = stateRef.current;
    const it = currentItem(s);
    const q = it ? questions.get(it.questionId) : undefined;
    if (s.phase !== 'question' || s.selected === null || !it || !q) return;
    const now = services.clock.now();
    const { correct } = gradeMcq(q, it, s.selected);
    dispatch({ type: 'answer', correct, now });
    recordReview(services, q, correct, now - s.shownAt).catch(() => setSaveFailed(true));
  }, [dispatch, questions, services]);

  return {
    state,
    question,
    lastAnswerCorrect: lastAnswer?.correct,
    select: (displayIndex) => dispatch({ type: 'select', displayIndex }),
    check,
    next: () => dispatch({ type: 'continue', now: services.clock.now() }),
    saveFailed,
  };
}
