import { describe, expect, it } from 'vitest';
import { strings, t } from './strings.ts';

describe('strings', () => {
  it('fills placeholders', () => {
    expect(t('session.progress', { current: 3, total: 10 })).toBe('3 / 10');
    expect(t('today.ready', { n: 7 })).toBe('7 questions ready');
  });

  it('contains no emoji (CLAUDE.md)', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    expect(Object.values(strings).filter((s) => emoji.test(s))).toEqual([]);
  });
});
