import { describe, expect, it } from 'vitest';
import { strings, t } from './strings.ts';

describe('strings', () => {
  it('fills placeholders', () => {
    expect(t('session.progress', { current: 3, total: 10 })).toBe('3 / 10');
    expect(t('today.counts', { due: 3, fresh: 7 })).toBe('3 due, 7 new');
  });

  it('contains no emoji (CLAUDE.md)', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    expect(Object.values(strings).filter((s) => emoji.test(s))).toEqual([]);
  });
});
