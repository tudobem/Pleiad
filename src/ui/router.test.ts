import { describe, expect, it } from 'vitest';
import { parseRoute } from './router.ts';

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
