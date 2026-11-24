import type { SessionItem } from './session.ts';

/**
 * Session state machine. Plain serializable data so an interrupted session
 * can be saved and resumed (SPEC 8). Time values come from the injected clock
 * and are passed in with each action.
 *
 * An answer is recorded when checked, but its review event is committed when
 * the user leaves the feedback screen (Continue or Too easy), so the final
 * rating is known. While `phase` is "feedback", the last answer is pending.
 */
export type SessionMode = 'scheduled' | 'extra';

export interface AnswerRecord {
  readonly questionId: string;
  readonly chosenDisplayIndex: number;
  readonly correct: boolean;
  readonly responseMs: number;
  /** When the answer was checked (UTC ms); becomes the review event's ts. */
  readonly answeredAt: number;
  readonly tooEasy: boolean;
}

export type SessionPhase = 'question' | 'feedback' | 'done';

export interface SessionState {
  readonly id: string;
  /** Scheduled (Daily queue, changes FSRS) or extra practice (SPEC 7.6). */
  readonly mode: SessionMode;
  /** Learning day the session was built for. */
  readonly day: number;
  readonly items: readonly SessionItem[];
  readonly index: number;
  readonly phase: SessionPhase;
  /** Display index currently selected, before checking. */
  readonly selected: number | null;
  /** When the current question was shown (epoch ms). */
  readonly shownAt: number;
  readonly answers: readonly AnswerRecord[];
}

export type SessionAction =
  | { readonly type: 'select'; readonly displayIndex: number }
  | { readonly type: 'answer'; readonly correct: boolean; readonly now: number }
  | { readonly type: 'continue'; readonly now: number; readonly tooEasy?: boolean }
  /** Restart the response timer after resuming a saved session. */
  | { readonly type: 'resume'; readonly now: number };

export interface StartOptions {
  readonly mode: SessionMode;
  readonly day: number;
}

export function startSession(
  id: string,
  items: readonly SessionItem[],
  now: number,
  { mode, day }: StartOptions,
): SessionState {
  return {
    id,
    mode,
    day,
    items,
    index: 0,
    phase: items.length === 0 ? 'done' : 'question',
    selected: null,
    shownAt: now,
    answers: [],
  };
}

export function currentItem(state: SessionState): SessionItem | undefined {
  return state.phase === 'done' ? undefined : state.items[state.index];
}

/** The answer awaiting commit (the user is on its feedback screen), if any. */
export function pendingAnswer(state: SessionState): AnswerRecord | undefined {
  return state.phase === 'feedback' ? state.answers[state.answers.length - 1] : undefined;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'select': {
      if (state.phase !== 'question') return state;
      const item = state.items[state.index];
      if (!item || action.displayIndex < 0 || action.displayIndex >= item.displayOrder.length) {
        return state;
      }
      return { ...state, selected: action.displayIndex };
    }
    case 'answer': {
      const item = state.items[state.index];
      if (state.phase !== 'question' || state.selected === null || !item) return state;
      const record: AnswerRecord = {
        questionId: item.questionId,
        chosenDisplayIndex: state.selected,
        correct: action.correct,
        responseMs: Math.max(0, action.now - state.shownAt),
        answeredAt: action.now,
        tooEasy: false,
      };
      return { ...state, phase: 'feedback', answers: [...state.answers, record] };
    }
    case 'continue': {
      if (state.phase !== 'feedback') return state;
      const last = state.answers[state.answers.length - 1];
      const answers =
        last && action.tooEasy && last.correct
          ? [...state.answers.slice(0, -1), { ...last, tooEasy: true }]
          : state.answers;
      const index = state.index + 1;
      return {
        ...state,
        answers,
        index,
        phase: index >= state.items.length ? 'done' : 'question',
        selected: null,
        shownAt: action.now,
      };
    }
    case 'resume':
      return state.phase === 'question' ? { ...state, shownAt: action.now } : state;
  }
}

export function sessionScore(state: SessionState): { correct: number; answered: number } {
  return {
    correct: state.answers.filter((a) => a.correct).length,
    answered: state.answers.length,
  };
}

/** Saved sessions from before M3 have no mode; they cannot be resumed. */
export function isCurrentSessionShape(value: unknown): value is SessionState {
  const s = value as Partial<SessionState> | null;
  return (
    !!s &&
    (s.mode === 'scheduled' || s.mode === 'extra') &&
    typeof s.day === 'number' &&
    Array.isArray(s.items) &&
    Array.isArray(s.answers)
  );
}
