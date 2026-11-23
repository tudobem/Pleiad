import { describe, expect, it } from 'vitest';
import {
  currentItem,
  sessionReducer,
  sessionScore,
  startSession,
  type SessionState,
} from './reducer.ts';

const items = [
  { questionId: 'q1', displayOrder: [1, 0, 2, 3] },
  { questionId: 'q2', displayOrder: [0, 1, 2, 3] },
];

function run(
  state: SessionState,
  ...actions: Parameters<typeof sessionReducer>[1][]
): SessionState {
  return actions.reduce(sessionReducer, state);
}

describe('sessionReducer', () => {
  it('runs a full session and records answers with response times', () => {
    const s = run(
      startSession('s1', items, 1000),
      { type: 'select', displayIndex: 2 },
      { type: 'answer', correct: false, now: 4000 },
      { type: 'continue', now: 5000 },
      { type: 'select', displayIndex: 0 },
      { type: 'answer', correct: true, now: 6500 },
      { type: 'continue', now: 7000 },
    );
    expect(s.phase).toBe('done');
    expect(s.answers).toEqual([
      { questionId: 'q1', chosenDisplayIndex: 2, correct: false, responseMs: 3000 },
      { questionId: 'q2', chosenDisplayIndex: 0, correct: true, responseMs: 1500 },
    ]);
    expect(sessionScore(s)).toEqual({ correct: 1, answered: 2 });
    expect(currentItem(s)).toBeUndefined();
  });

  it('ignores answering without a selection and actions in the wrong phase', () => {
    const start = startSession('s1', items, 0);
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

  it('allows changing the selection before checking', () => {
    const s = run(
      startSession('s1', items, 0),
      { type: 'select', displayIndex: 1 },
      { type: 'select', displayIndex: 3 },
    );
    expect(s.selected).toBe(3);
  });

  it('survives a JSON round trip and restarts the timer on resume', () => {
    const s = run(startSession('s1', items, 0), { type: 'select', displayIndex: 1 });
    const restored = JSON.parse(JSON.stringify(s)) as SessionState;
    expect(restored).toEqual(s);
    const resumed = sessionReducer(restored, { type: 'resume', now: 60_000 });
    expect(resumed.shownAt).toBe(60_000);
    const done = run(resumed, { type: 'answer', correct: true, now: 61_000 });
    expect(done.answers[0]?.responseMs).toBe(1000);
  });

  it('starts an empty session as done', () => {
    expect(startSession('s', [], 0).phase).toBe('done');
  });
});
