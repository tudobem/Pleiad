import { describe, expect, it } from 'vitest';
import { href, parseLocation, parseRoute } from './router.ts';

describe('parseRoute', () => {
  it.each([
    ['', 'today'],
    ['#/', 'today'],
    ['#/stats', 'stats'],
    ['#session', 'session'],
    ['#/library/topic', 'library'],
    ['#/nowhere', 'today'],
  ])('%s -> %s', (hash, route) => {
    expect(parseRoute(hash)).toBe(route);
  });
});

describe('parseLocation and href', () => {
  it('reads a subject ID and a branch to open', () => {
    expect(parseLocation('#/library/philosophy-of-mind?open=pom-method')).toEqual({
      name: 'library',
      id: 'philosophy-of-mind',
      open: 'pom-method',
    });
    expect(parseLocation('#/library')).toEqual({ name: 'library' });
    expect(parseLocation('#/library/%E0%A4%A')).toEqual({ name: 'library' });
  });

  it('round-trips through href', () => {
    const link = href('library', 'a b', 'c/d');
    expect(link).toBe('#/library/a%20b?open=c%2Fd');
    expect(parseLocation(link)).toEqual({ name: 'library', id: 'a b', open: 'c/d' });
    expect(href('today')).toBe('#/today');
  });
});
