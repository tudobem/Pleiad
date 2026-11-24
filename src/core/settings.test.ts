import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings.ts';

describe('normalizeSettings', () => {
  it('fills defaults', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ newPerDay: 5 }).newPerDay).toBe(5);
  });

  it('clamps out-of-range values', () => {
    const s = normalizeSettings({
      newPerDay: 99,
      reviewCap: -3,
      desiredRetention: 0.99,
      tierMix: { foundational: 0, advanced: 0, expert: 0 },
    });
    expect(s.newPerDay).toBe(50);
    expect(s.reviewCap).toBe(0);
    expect(s.desiredRetention).toBe(0.95);
    expect(s.tierMix).toEqual(DEFAULT_SETTINGS.tierMix);
  });
});
