import { describe, expect, it } from 'vitest';
import { keyCommand, type KeyContext } from './keys.ts';

const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({
  phase: 'question',
  type: 'mcq',
  optionCount: 4,
  canCheck: true,
  busy: false,
  ...over,
});

describe('keyCommand', () => {
  it('selects MCQ options with 1 to the number of options', () => {
    expect(keyCommand('1', ctx())).toEqual({ kind: 'select', index: 0 });
    expect(keyCommand('4', ctx())).toEqual({ kind: 'select', index: 3 });
    expect(keyCommand('5', ctx())).toBeNull();
    expect(keyCommand('5', ctx({ optionCount: 5 }))).toEqual({ kind: 'select', index: 4 });
    expect(keyCommand('6', ctx({ optionCount: 6 }))).toBeNull();
    expect(keyCommand('1', ctx({ type: 'match' }))).toBeNull();
  });

  it('checks or reveals with Space or Enter when possible', () => {
    expect(keyCommand(' ', ctx())).toEqual({ kind: 'check' });
    expect(keyCommand('Enter', ctx({ type: 'recall' }))).toEqual({ kind: 'check' });
    expect(keyCommand(' ', ctx({ canCheck: false }))).toBeNull();
    expect(keyCommand('a', ctx())).toBeNull();
  });

  it('continues after feedback, and rates a revealed recall item', () => {
    expect(keyCommand(' ', ctx({ phase: 'feedback' }))).toEqual({ kind: 'next' });
    expect(keyCommand('1', ctx({ phase: 'feedback' }))).toBeNull();
    const recall = ctx({ phase: 'feedback', type: 'recall' });
    expect(keyCommand('1', recall)).toEqual({ kind: 'rate', rating: 'again' });
    expect(keyCommand('3', recall)).toEqual({ kind: 'rate', rating: 'good' });
    expect(keyCommand('4', recall)).toEqual({ kind: 'rate', rating: 'easy' });
    expect(keyCommand('5', recall)).toBeNull();
    expect(keyCommand(' ', recall)).toBeNull();
  });

  it('ignores keys while busy', () => {
    expect(keyCommand(' ', ctx({ phase: 'feedback', busy: true }))).toBeNull();
  });
});
