import type { Confidence, Rating } from '../sync/reviewEvent.ts';
import type { Response } from './response.ts';
import type { SessionItem } from './session.ts';

/**
 * Session state machine. Plain serializable data so an interrupted session
 * can be saved and resumed (SPEC 8). Time values come from the injected clock
 * and are passed in with each action.
 *
 * An answer is recorded when checked (or, for recall, when the answer is
 * shown), but its review event is committed when the user leaves the
 * feedback screen, so the final rating is known: Too easy, a short-answer
 * override, or the recall self-rating. While `phase` is "feedback", the last
 * answer is pending.
 */
export type SessionMode = 'scheduled' | 'extra';

export interface AnswerRecord {
  readonly questionId: string;
  readonly response: Response;
  /** Auto-graded result, after any override; for recall, set from the self-rating. */
  readonly correct: boolean;
  readonly responseMs: number;
  /** When the answer was checked (UTC ms); becomes the review event's ts. */
  readonly answeredAt: number;
  readonly tooEasy: boolean;
  /** Recall: the rating the user chose (SPEC 7.3). */
  readonly selfRating?: Rating;
  /** Short answer: the user corrected the auto-grade ("I was right/wrong"). */
  readonly overridden?: boolean;
  /** Confidence chosen before answering (SPEC 9; MCQ and short only). */
  readonly confidence?: Confidence;
}

/** A placement quiz (SPEC 13): the packs it places, and where to go when it ends. */
export interface PlacementInfo {
  readonly packs: readonly string[];
  /** Hash route to return to, e.g. the welcome flow or a subject page. */
  readonly returnTo?: string;
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
  /** What the user has entered for the current question so far. */
  readonly response: Response | null;
  /** When the current question was shown (epoch ms). */
  readonly shownAt: number;
  readonly answers: readonly AnswerRecord[];
  /** Selected confidence chip; kept from question to question (DESIGN 4.2). */
  readonly confidence?: Confidence;
  /** A placement quiz (SPEC 13) for these packs; it grows one question at a time. */
  readonly placement?: PlacementInfo;
}

/** Question types that ask for confidence (SPEC 9). */
export const CONFIDENCE_TYPES: readonly Response['type'][] = ['mcq', 'short'];

export interface LeaveOptions {
  /** Rate a correct auto-graded answer Easy. */
  readonly tooEasy?: boolean;
  /** Recall self-rating. */
  readonly rating?: Rating;
}

export type SessionAction =
  | { readonly type: 'respond'; readonly response: Response }
  | { readonly type: 'confidence'; readonly confidence: Confidence | null }
  | { readonly type: 'answer'; readonly correct: boolean; readonly now: number }
  /** Short answers: the user says the auto-grade was wrong. */
  | { readonly type: 'override'; readonly correct: boolean }
  | ({
      readonly type: 'continue';
      readonly now: number;
      /** Placement: the next question, added before moving on. */
      readonly append?: SessionItem;
    } & LeaveOptions)
  /** Restart the response timer after resuming a saved session. */
  | { readonly type: 'resume'; readonly now: number };

export interface StartOptions {
  readonly mode: SessionMode;
  readonly day: number;
  readonly placement?: PlacementInfo;
}

export function startSession(
  id: string,
  items: readonly SessionItem[],
  now: number,
  { mode, day, placement }: StartOptions,
): SessionState {
  return {
    id,
    mode,
    day,
    ...(placement ? { placement } : {}),
    items,
    index: 0,
    phase: items.length === 0 ? 'done' : 'question',
    response: null,
    shownAt: now,
    answers: [],
  };
}

export function currentItem(state: SessionState): SessionItem | undefined {
  return state.phase === 'done' ? undefined : state.items[state.index];
}

/** Mode of the current item (or the pending answer's item): its own, else the session's. */
export function itemMode(state: SessionState): SessionMode {
  return state.items[state.index]?.mode ?? state.mode;
}

/** The answer awaiting commit (the user is on its feedback screen), if any. */
export function pendingAnswer(state: SessionState): AnswerRecord | undefined {
  return state.phase === 'feedback' ? state.answers[state.answers.length - 1] : undefined;
}

/** The answer as it will be logged once the user leaves feedback with these options. */
export function finalizeAnswer(answer: AnswerRecord, options: LeaveOptions = {}): AnswerRecord {
  if (answer.response.type === 'recall') {
    const rating = options.rating ?? answer.selfRating;
    return rating ? { ...answer, selfRating: rating, correct: rating !== 'again' } : answer;
  }
  return options.tooEasy && answer.correct ? { ...answer, tooEasy: true } : answer;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'respond':
      return state.phase === 'question' ? { ...state, response: action.response } : state;
    case 'confidence': {
      if (state.phase !== 'question') return state;
      if (action.confidence) return { ...state, confidence: action.confidence };
      // Clearing removes the field so saved sessions stay minimal.
      return Object.fromEntries(
        Object.entries(state).filter(([key]) => key !== 'confidence'),
      ) as unknown as SessionState;
    }
    case 'answer': {
      const item = state.items[state.index];
      if (state.phase !== 'question' || state.response === null || !item) return state;
      const asksConfidence = CONFIDENCE_TYPES.includes(state.response.type);
      const record: AnswerRecord = {
        questionId: item.questionId,
        response: state.response,
        correct: action.correct,
        responseMs: Math.max(0, action.now - state.shownAt),
        answeredAt: action.now,
        tooEasy: false,
        ...(asksConfidence && state.confidence ? { confidence: state.confidence } : {}),
      };
      return { ...state, phase: 'feedback', answers: [...state.answers, record] };
    }
    case 'override': {
      const last = pendingAnswer(state);
      if (!last || last.response.type !== 'short') return state;
      return {
        ...state,
        answers: [
          ...state.answers.slice(0, -1),
          { ...last, correct: action.correct, overridden: true },
        ],
      };
    }
    case 'continue': {
      const last = pendingAnswer(state);
      if (!last) return state;
      if (last.response.type === 'recall' && !action.rating) return state;
      const index = state.index + 1;
      const items = action.append ? [...state.items, action.append] : state.items;
      return {
        ...state,
        items,
        answers: [...state.answers.slice(0, -1), finalizeAnswer(last, action)],
        index,
        phase: index >= items.length ? 'done' : 'question',
        response: null,
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

/**
 * Bring a saved session up to the current shape, or return null if it cannot
 * be resumed. M3 sessions (MCQ only, `displayOrder`/`selected`) are migrated;
 * sessions from before M3 (no mode) are dropped.
 */
export function migrateSession(value: unknown): SessionState | null {
  const s = value as Record<string, unknown> | null;
  if (!s || (s.mode !== 'scheduled' && s.mode !== 'extra') || typeof s.day !== 'number') {
    return null;
  }
  if (!Array.isArray(s.items) || !Array.isArray(s.answers)) return null;
  if ('response' in s) return s as unknown as SessionState;

  // M3 shape: MCQ only.
  type OldItem = { questionId: string; displayOrder: number[] };
  type OldAnswer = Omit<AnswerRecord, 'response'> & { chosenDisplayIndex: number };
  const { selected, ...rest } = s as unknown as { selected: number | null } & SessionState;
  return {
    ...rest,
    items: (s.items as OldItem[]).map((i) => ({
      questionId: i.questionId,
      layout: i.displayOrder,
    })),
    answers: (s.answers as OldAnswer[]).map(({ chosenDisplayIndex, ...a }) => ({
      ...a,
      response: { type: 'mcq', choice: chosenDisplayIndex },
    })),
    response:
      selected === null || selected === undefined ? null : { type: 'mcq', choice: selected },
  };
}
