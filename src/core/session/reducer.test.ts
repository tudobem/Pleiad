import { describe, expect, it } from 'vitest';
import {
  currentItem,
  finalizeAnswer,
  migrateSession,
  pendingAnswer,
  sessionReducer,
  sessionScore,
  startSession,
  type SessionAction,
  type SessionState,
} from './reducer.ts';

const items = [
  { questionId: 'q1', layout: [1, 0, 2, 3] },
  { questionId: 'q2', layout: [0, 1, 2, 3] },
];
const opts = { mode: 'scheduled' as const, day: 20_000 };
const mcq = (choice: number): SessionAction => ({
  type: 'respond',
  response: { type: 'mcq', choice },
});

function run(state: SessionState, ...actions: SessionAction[]): SessionState {
  return actions.reduce(sessionReducer, state);
}

describe('sessionReducer', () => {
  it('runs a full session and records answers with times', () => {
    const s = run(
      startSession('s1', items, 1000, opts),
      mcq(2),
      { type: 'answer', correct: false, now: 4000 },
      { type: 'continue', now: 5000 },
      mcq(0),
      { type: 'answer', correct: true, now: 6500 },
      { type: 'continue', now: 7000 },
    );
    expect(s.phase).toBe('done');
    expect(s.answers).toEqual([
      {
        questionId: 'q1',
        response: { type: 'mcq', choice: 2 },
        correct: false,
        responseMs: 3000,
        answeredAt: 4000,
        tooEasy: false,
      },
      {
        questionId: 'q2',
        response: { type: 'mcq', choice: 0 },
        correct: true,
        responseMs: 1500,
        answeredAt: 6500,
        tooEasy: false,
      },
    ]);
    expect(sessionScore(s)).toEqual({ correct: 1, answered: 2 });
    expect(currentItem(s)).toBeUndefined();
  });

  it('exposes the pending answer only on the feedback screen', () => {
    const start = startSession('s1', items, 0, opts);
    expect(pendingAnswer(start)).toBeUndefined();
    const fb = run(start, mcq(0), { type: 'answer', correct: true, now: 10 });
    expect(pendingAnswer(fb)?.questionId).toBe('q1');
    expect(pendingAnswer(run(fb, { type: 'continue', now: 20 }))).toBeUndefined();
  });

  it('marks Too easy only on a correct answer', () => {
    const right = run(
      startSession('s1', items, 0, opts),
      mcq(0),
      { type: 'answer', correct: true, now: 10 },
      { type: 'continue', now: 20, tooEasy: true },
    );
    expect(right.answers[0]?.tooEasy).toBe(true);
    const wrong = run(
      startSession('s1', items, 0, opts),
      mcq(0),
      { type: 'answer', correct: false, now: 10 },
      { type: 'continue', now: 20, tooEasy: true },
    );
    expect(wrong.answers[0]?.tooEasy).toBe(false);
  });

  it('lets short answers be overridden on the feedback screen', () => {
    const s = run(
      startSession('s1', items, 0, opts),
      { type: 'respond', response: { type: 'short', text: 'Tononni' } },
      { type: 'answer', correct: false, now: 10 },
      { type: 'override', correct: true },
    );
    expect(pendingAnswer(s)).toMatchObject({ correct: true, overridden: true });
    // Not for other types.
    const m = run(startSession('s1', items, 0, opts), mcq(1), {
      type: 'answer',
      correct: false,
      now: 10,
    });
    expect(sessionReducer(m, { type: 'override', correct: true })).toBe(m);
  });

  it('requires a self-rating to leave a recall answer', () => {
    const shown = run(
      startSession('s1', items, 0, opts),
      { type: 'respond', response: { type: 'recall' } },
      { type: 'answer', correct: false, now: 2500 },
    );
    expect(sessionReducer(shown, { type: 'continue', now: 3000 })).toBe(shown);
    const rated = sessionReducer(shown, { type: 'continue', now: 3000, rating: 'hard' });
    expect(rated.answers[0]).toMatchObject({ selfRating: 'hard', correct: true, responseMs: 2500 });
    const again = sessionReducer(shown, { type: 'continue', now: 3000, rating: 'again' });
    expect(again.answers[0]).toMatchObject({ selfRating: 'again', correct: false });
  });

  it('ignores answering without a response and actions in the wrong phase', () => {
    const start = startSession('s1', items, 0, opts);
    expect(sessionReducer(start, { type: 'answer', correct: true, now: 1 })).toBe(start);
    expect(sessionReducer(start, { type: 'continue', now: 1 })).toBe(start);
    const answered = run(start, mcq(1), { type: 'answer', correct: true, now: 5 });
    expect(sessionReducer(answered, mcq(0))).toBe(answered);
    expect(sessionReducer(answered, { type: 'answer', correct: true, now: 6 })).toBe(answered);
  });

  it('survives a JSON round trip and restarts the timer on resume', () => {
    const s = run(startSession('s1', items, 0, opts), mcq(1));
    const restored = migrateSession(JSON.parse(JSON.stringify(s)));
    expect(restored).toEqual(s);
    const resumed = sessionReducer(restored as SessionState, { type: 'resume', now: 60_000 });
    expect(resumed.shownAt).toBe(60_000);
    expect(
      run(resumed, { type: 'answer', correct: true, now: 61_000 }).answers[0]?.responseMs,
    ).toBe(1000);
  });

  it('starts an empty session as done', () => {
    expect(startSession('s', [], 0, opts).phase).toBe('done');
  });
});

describe('finalizeAnswer', () => {
  const base = { questionId: 'q', correct: true, responseMs: 1, answeredAt: 1, tooEasy: false };
  it('applies Too easy and recall ratings', () => {
    expect(
      finalizeAnswer({ ...base, response: { type: 'mcq', choice: 0 } }, { tooEasy: true }).tooEasy,
    ).toBe(true);
    expect(
      finalizeAnswer({ ...base, response: { type: 'recall' } }, { rating: 'again' }),
    ).toMatchObject({ correct: false, selfRating: 'again' });
  });
});

describe('migrateSession', () => {
  it('converts an M3 (MCQ only) session', () => {
    const m3 = {
      id: 's',
      mode: 'scheduled',
      day: 5,
      index: 1,
      phase: 'question',
      selected: 2,
      shownAt: 9,
      items: [
        { questionId: 'a', displayOrder: [2, 0, 1, 3] },
        { questionId: 'b', displayOrder: [0, 1, 2, 3] },
      ],
      answers: [
        {
          questionId: 'a',
          chosenDisplayIndex: 1,
          correct: true,
          responseMs: 5,
          answeredAt: 8,
          tooEasy: false,
        },
      ],
    };
    const s = migrateSession(m3);
    expect(s?.items[0]).toEqual({ questionId: 'a', layout: [2, 0, 1, 3] });
    expect(s?.answers[0]?.response).toEqual({ type: 'mcq', choice: 1 });
    expect(s?.response).toEqual({ type: 'mcq', choice: 2 });
    expect(s).not.toHaveProperty('selected');
  });

  it('drops sessions from before M3 and junk', () => {
    expect(migrateSession({ id: 's', items: [], answers: [] })).toBeNull();
    expect(migrateSession(null)).toBeNull();
  });
});

describe('confidence (SPEC 9)', () => {
  const start = () => startSession('s', items, 0, opts);
  const certain: SessionAction = { type: 'confidence', confidence: 'certain' };

  it('records the chosen confidence with MCQ and short answers and keeps it for the next question', () => {
    const s = run(
      start(),
      certain,
      mcq(0),
      { type: 'answer', correct: false, now: 10 },
      { type: 'continue', now: 11 },
    );
    expect(s.answers[0]?.confidence).toBe('certain');
    expect(s.confidence).toBe('certain');
    const short = run(
      s,
      { type: 'respond', response: { type: 'short', text: 'x' } },
      { type: 'answer', correct: true, now: 20 },
    );
    expect(short.answers[1]?.confidence).toBe('certain');
  });

  it('can be cleared, is ignored on feedback, and is not recorded for other types', () => {
    const cleared = run(start(), certain, { type: 'confidence', confidence: null });
    expect(cleared).not.toHaveProperty('confidence');
    const feedback = run(start(), mcq(0), { type: 'answer', correct: true, now: 5 }, certain);
    expect(feedback.confidence).toBeUndefined();
    const recall = run(
      start(),
      certain,
      { type: 'respond', response: { type: 'recall' } },
      { type: 'answer', correct: false, now: 5 },
    );
    expect(recall.answers[0]).not.toHaveProperty('confidence');
  });

  it('still loads saved sessions without the field', () => {
    const saved = JSON.parse(JSON.stringify(start()));
    expect(migrateSession(saved)).toEqual(start());
  });
});
