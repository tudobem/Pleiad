import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings.ts';
import { needsOnboarding, PACES, paceOf } from './pace.ts';

describe('pace', () => {
  it('maps settings to presets', () => {
    expect(paceOf(DEFAULT_SETTINGS)).toBe('steady');
    expect(paceOf(PACES.relaxed)).toBe('relaxed');
    expect(paceOf(PACES.intense)).toBe('intense');
    expect(paceOf({ newPerDay: 5, dailyGoal: 40 })).toBe('custom');
  });

  it('shows the welcome only to a fresh profile', () => {
    expect(needsOnboarding(0, false)).toBe(true);
    expect(needsOnboarding(3, false)).toBe(false);
    expect(needsOnboarding(0, true)).toBe(false);
  });
});
