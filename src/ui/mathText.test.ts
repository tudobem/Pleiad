import { describe, expect, it } from 'vitest';
import { splitMath } from './mathText.ts';

describe('splitMath', () => {
  it('separates inline LaTeX from text', () => {
    expect(splitMath('What does $\\Phi$ measure?')).toEqual([
      { value: 'What does ', math: false },
      { value: '\\Phi', math: true },
      { value: ' measure?', math: false },
    ]);
  });

  it('leaves text without math alone, including a lone dollar sign', () => {
    expect(splitMath('Costs $5 today')).toEqual([{ value: 'Costs $5 today', math: false }]);
    expect(splitMath('')).toEqual([]);
  });
});
