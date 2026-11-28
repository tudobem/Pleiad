import { describe, expect, it } from 'vitest';
import { grade } from './grading.ts';
import { emptyResponse, isComplete } from './response.ts';
import {
  cloze,
  estimation,
  match,
  mcq,
  order,
  recall,
  short,
  timeline,
} from '../content/fixtures.test-util.ts';

describe('grade', () => {
  it('mcq: maps the display choice back through the layout', () => {
    const q = mcq({ answer: 2 });
    expect(grade(q, [3, 2, 0, 1], { type: 'mcq', choice: 1 }).correct).toBe(true);
    expect(grade(q, [3, 2, 0, 1], { type: 'mcq', choice: 0 }).correct).toBe(false);
  });

  it('short: accepts variants, case, accents and plurals; numbers within tolerance', () => {
    const q = short();
    for (const text of ['tononi', ' GIULIO tononi ', 'Tonóni']) {
      expect(grade(q, [], { type: 'short', text }).correct).toBe(true);
    }
    expect(grade(q, [], { type: 'short', text: 'Baars' }).correct).toBe(false);
    const n = short({ answers: ['16000000000'], numeric: { value: 16e9, tolerance: 1e9 } });
    expect(grade(n, [], { type: 'short', text: '16,500,000,000' }).correct).toBe(true);
    expect(grade(n, [], { type: 'short', text: '20000000000' }).correct).toBe(false);
  });

  it('cloze: every blank must hold its answer', () => {
    // Chips: 0 Tononi, 1 2004, 2 Baars, 3 1988. Layout shows them as [2, 0, 3, 1].
    const q = cloze();
    const layout = [2, 0, 3, 1];
    expect(grade(q, layout, { type: 'cloze', fills: [1, 3] })).toEqual({
      correct: true,
      parts: [true, true],
    });
    expect(grade(q, layout, { type: 'cloze', fills: [1, 2] })).toEqual({
      correct: false,
      parts: [true, false],
    });
    expect(grade(q, layout, { type: 'cloze', fills: [0, null] }).parts).toEqual([false, false]);
  });

  it('match: every pair must be right; one wrong pair is an error', () => {
    const q = match();
    const layout = [1, 2, 0]; // display 0 = right #1, display 1 = right #2, display 2 = right #0
    expect(grade(q, layout, { type: 'match', pairs: [2, 0, 1] })).toEqual({
      correct: true,
      parts: [true, true, true],
    });
    expect(grade(q, layout, { type: 'match', pairs: [2, 1, 0] })).toEqual({
      correct: false,
      parts: [true, false, false],
    });
  });

  it('order: exact sequence, marked per position', () => {
    const q = order();
    const layout = [2, 0, 1];
    expect(grade(q, layout, { type: 'order', sequence: [1, 2, 0] })).toEqual({
      correct: true,
      parts: [true, true, true],
    });
    expect(grade(q, layout, { type: 'order', sequence: [1, 0, 2] })).toEqual({
      correct: false,
      parts: [true, false, false],
    });
  });

  it('timeline: date order, marked per position', () => {
    const q = timeline(); // 1995, 1974, 1982
    const layout = [0, 1, 2];
    expect(grade(q, layout, { type: 'timeline', sequence: [1, 2, 0] })).toEqual({
      correct: true,
      parts: [true, true, true],
    });
    expect(grade(q, layout, { type: 'timeline', sequence: [2, 1, 0] }).parts).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('estimation: slider within tolerance, or the right bin', () => {
    const q = estimation(); // 86 billion, factor 2
    const r = (value: number) => ({ type: 'estimation' as const, bin: null, value });
    expect(grade(q, [], r(50e9)).correct).toBe(true);
    expect(grade(q, [], r(40e9)).correct).toBe(false);
    const binned = {
      ...q,
      bins: [
        { min: 1e6, max: 1e9 },
        { min: 1e9, max: 1e11 },
        { min: 1e11, max: 1e13 },
      ],
    };
    expect(grade(binned, [], { type: 'estimation', bin: 1, value: null }).correct).toBe(true);
    expect(grade(binned, [], { type: 'estimation', bin: 2, value: null }).correct).toBe(false);
  });

  it('recall is never auto-graded', () => {
    expect(grade(recall(), [], { type: 'recall' }).parts).toEqual([]);
  });

  it('rejects a response of the wrong type', () => {
    expect(() => grade(mcq(), [0, 1, 2, 3], { type: 'short', text: 'x' })).toThrow();
  });
});

describe('isComplete', () => {
  it('needs every part answered before checking', () => {
    expect(isComplete(mcq(), emptyResponse(mcq()))).toBe(false);
    expect(isComplete(mcq(), { type: 'mcq', choice: 0 })).toBe(true);
    expect(isComplete(short(), { type: 'short', text: '  ' })).toBe(false);
    expect(isComplete(cloze(), { type: 'cloze', fills: [0, null] })).toBe(false);
    expect(isComplete(cloze(), { type: 'cloze', fills: [0, 1] })).toBe(true);
    expect(isComplete(match(), emptyResponse(match()))).toBe(false);
    expect(isComplete(order(), { type: 'order', sequence: [0, 1] })).toBe(false);
    expect(isComplete(order(), { type: 'order', sequence: [0, 1, 2] })).toBe(true);
    expect(isComplete(recall(), emptyResponse(recall()))).toBe(true);
    expect(isComplete(mcq(), null)).toBe(false);
  });
});
