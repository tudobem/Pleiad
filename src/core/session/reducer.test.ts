import { describe, expect, it } from 'vitest';
import {
  currentItem,
  isCurrentSessionShape,
  pendingAnswer,
  sessionReducer,
  sessionScore,
  startSession,
  type SessionState,
} from './reducer.ts';

const items = [
  { questionId: 'q1', displayOrder: [1, 0, 2, 3] },
  { questionId: 'q2', displayOrder: [0, 1, 2, 3] },
];
const opts = { mode: 'scheduled' as const, day: 20_000 };

function run(
  state: SessionState,
  ...actions: Parameters<typeof sessionReducer>[1][]
): SessionState {
  return actions.reduce(sessionReducer, state);
}

describe('sessionReducer', () => {
  it('runs a full session and records answers with times', () => {
    const s = run(
      startSession('s1', items, 1000, opts),
      { type: 'select', displayIndex: 2 },
      { type: 'answer', correct: false, now: 4000 },
      { type: 'continue', now: 5000 },
      { type: 'select', displayIndex: 0 },
      { type: 'answer', correct: true, now: 6500 },
      { type: 'continue', now: 7000 },
    );
    expect(s.phase).toBe('done');
    expect(s.answers).toEqual([
      {
        questionId: 'q1',
        chosenDisplayIndex: 2,
        correct: false,
        responseMs: 3000,
        answeredAt: 4000,
        tooEasy: false,
      },
      {
        questionId: 'q2',
        chosenDisplayIndex: 0,
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
    const fb = run(
      start,
      { type: 'select', displayIndex: 0 },
      { type: 'answer', correct: true, now: 10 },
    );
    expect(pendingAnswer(fb)?.questionId).toBe('q1');
    expect(pendingAnswer(run(fb, { type: 'continue', now: 20 }))).toBeUndefined();
  });

  it('marks Too easy only on a correct answer', () => {
    const right = run(
      startSession('s1', items, 0, opts),
      { type: 'select', displayIndex: 0 },
      { type: 'answer', correct: true, now: 10 },
      { type: 'continue', now: 20, tooEasy: true },
    );
    expect(right.answers[0]?.tooEasy).toBe(true);
    const wrong = run(
      startSession('s1', items, 0, opts),
      { type: 'select', displayIndex: 0 },
      { type: 'answer', correct: false, now: 10 },
      { type: 'continue', now: 20, tooEasy: true },
    );
    expect(wrong.answers[0]?.tooEasy).toBe(false);
  });

  it('ignores answering without a selection and actions in the wrong phase', () => {
    const start = startSession('s1', items, 0, opts);
    expect(sessionReducer(start, { type: 'answer', correct: true, now: 1 })).toBe(start);
    expect(sessionReducer(start, { type: 'continue', now: 1 })).toBe(start);
    expect(sessionReducer(start, { type: 'select', displayIndex: 9 })).toBe(start);
    const answered = run(
      start,
      { type: 'select', displayIndex: 1 },
      { type: 'answer', correct: true, now: 5 },
    );
    expect(sessionReducer(answered, { type: 'select', displayIndex: 0 })).toBe(answered);
    expect(sessionReducer(answered, { type: 'answer', correct: true, now: 6 })).toBe(answered);
  });

  it('survives a JSON round trip and restarts the timer on resume', () => {
    const s = run(startSession('s1', items, 0, opts), { type: 'select', displayIndex: 1 });
    const restored = JSON.parse(JSON.stringify(s)) as SessionState;
    expect(restored).toEqual(s);
    expect(isCurrentSessionShape(restored)).toBe(true);
    const resumed = sessionReducer(restored, { type: 'resume', now: 60_000 });
    expect(resumed.shownAt).toBe(60_000);
    const done = run(resumed, { type: 'answer', correct: true, now: 61_000 });
    expect(done.answers[0]?.responseMs).toBe(1000);
  });

  it('rejects saved sessions from before M3', () => {
    const old = {
      id: 's',
      items,
      index: 0,
      phase: 'question',
      selected: null,
      shownAt: 0,
      answers: [],
    };
    expect(isCurrentSessionShape(old)).toBe(false);
    expect(isCurrentSessionShape(null)).toBe(false);
  });

  it('starts an empty session as done', () => {
    expect(startSession('s', [], 0, opts).phase).toBe('done');
  });
});
