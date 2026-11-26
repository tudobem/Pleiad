import { describe, expect, it } from 'vitest';
import { answersMatch, normalizeAnswer, parseNumber, sameWord } from './normalizeAnswer.ts';

describe('normalizeAnswer (SPEC 6)', () => {
  it.each([
    ['  Giulio   TONONI ', 'giulio tononi'],
    ['Nida-Rümelin', 'nida rumelin'],
    ['"Qualia"!', 'qualia'],
    ['3.5 billion', '3.5 billion'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });
});

describe('answersMatch', () => {
  it.each([
    ['Zombies', 'zombie'],
    ['theories', 'theory'],
    ['boxes', 'box'],
    ['  giulio tononi ', 'Giulio Tononi'],
    ['Nida Rumelin', 'Nida-Rümelin'],
  ])('%s matches %s', (a, b) => {
    expect(answersMatch(a, b)).toBe(true);
  });

  it.each([
    ['Tononi', 'Giulio Tononi'],
    ['zombi', 'zombie'],
    ['is', 'i'],
    ['dualism', 'monism'],
  ])('%s does not match %s', (a, b) => {
    expect(answersMatch(a, b)).toBe(false);
  });

  it('only applies plural rules to real words', () => {
    expect(sameWord('cat', 'cats')).toBe(true);
    expect(sameWord('19', '19s')).toBe(false);
  });
});

describe('parseNumber', () => {
  it.each([
    ['1000', 1000],
    ['1,000', 1000],
    ['1 000 000', 1_000_000],
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['-3', -3],
    ['8.6e10', 8.6e10],
    ['.5', 0.5],
  ])('%s -> %d', (input, value) => {
    expect(parseNumber(input)).toBe(value);
  });

  it.each(['', 'abc', '86 billion', '1.2.3'])('rejects %s', (input) => {
    expect(parseNumber(input)).toBeNull();
  });
});
