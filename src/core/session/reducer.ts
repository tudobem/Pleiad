import type { SessionItem } from './session.ts';

/**
 * Session state machine. Plain serializable data so an interrupted session
 * can be saved and resumed (SPEC 8). Time values come from the injected clock
 * and are passed in with each action.
 */
export interface AnswerRecord {
  readonly questionId: string;
  readonly chosenDisplayIndex: number;
  readonly correct: boolean;
  readonly responseMs: number;
}

export type SessionPhase = 'question' | 'feedback' | 'done';

export interface SessionState {
  readonly id: string;
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
  | { readonly type: 'continue'; readonly now: number }
  /** Restart the response timer after resuming a saved session. */
  | { readonly type: 'resume'; readonly now: number };

export function startSession(id: string, items: readonly SessionItem[], now: number): SessionState {
  return {
    id,
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
      };
      return { ...state, phase: 'feedback', answers: [...state.answers, record] };
    }
    case 'continue': {
      if (state.phase !== 'feedback') return state;
      const index = state.index + 1;
      return {
        ...state,
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
