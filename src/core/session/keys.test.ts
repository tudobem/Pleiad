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

describe('confidence keys', () => {
  it('maps Q, W, E to the confidence levels where asked', () => {
    expect(keyCommand('q', ctx({ asksConfidence: true }))).toEqual({
      kind: 'confidence',
      confidence: 'guess',
    });
    expect(keyCommand('W', ctx({ asksConfidence: true }))).toEqual({
      kind: 'confidence',
      confidence: 'fairly_sure',
    });
    expect(keyCommand('e', ctx({ asksConfidence: true }))).toEqual({
      kind: 'confidence',
      confidence: 'certain',
    });
    expect(keyCommand('e', ctx())).toBeNull();
    expect(keyCommand('e', ctx({ asksConfidence: true, phase: 'feedback' }))).toBeNull();
  });
});

describe('estimation keys', () => {
  it('digits tap a bin', () => {
    const ctx = {
      phase: 'question' as const,
      type: 'estimation' as const,
      optionCount: 6,
      canCheck: false,
      busy: false,
    };
    expect(keyCommand('6', ctx)).toEqual({ kind: 'select', index: 5 });
    expect(keyCommand('7', ctx)).toBeNull();
    expect(keyCommand('1', { ...ctx, optionCount: 0 })).toBeNull();
  });
});
