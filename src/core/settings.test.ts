import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  resolveActivePacks,
  withPacksActive,
} from './settings.ts';

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

describe('active packs', () => {
  const packs = ['a', 'b', 'c'];

  it('keeps only a string list, deduplicated', () => {
    expect(normalizeSettings({})).not.toHaveProperty('activePacks');
    const bad = { activePacks: 'a' } as unknown as Parameters<typeof normalizeSettings>[0];
    expect(normalizeSettings(bad)).not.toHaveProperty('activePacks');
    const mixed = { activePacks: ['a', 3, 'a', 'b'] } as unknown as Parameters<
      typeof normalizeSettings
    >[0];
    expect(normalizeSettings(mixed).activePacks).toEqual(['a', 'b']);
  });

  it('treats unset as all packs and ignores unknown ones', () => {
    expect(resolveActivePacks(DEFAULT_SETTINGS, packs)).toEqual(packs);
    expect(resolveActivePacks({ ...DEFAULT_SETTINGS, activePacks: ['c', 'gone'] }, packs)).toEqual([
      'c',
    ]);
    expect(resolveActivePacks({ ...DEFAULT_SETTINGS, activePacks: [] }, packs)).toEqual([]);
  });

  it('turns packs on and off, storing the full list', () => {
    const off = withPacksActive(DEFAULT_SETTINGS, packs, ['b'], false);
    expect(off.activePacks).toEqual(['a', 'c']);
    expect(withPacksActive(off, packs, ['b'], true).activePacks).toEqual(packs);
    expect(
      withPacksActive({ ...DEFAULT_SETTINGS, activePacks: [] }, packs, ['c'], true).activePacks,
    ).toEqual(['c']);
  });
});

describe('goal and rewards settings', () => {
  it('defaults to a goal of 20 with rewards on, and clamps the goal', () => {
    expect(normalizeSettings({})).toMatchObject({ dailyGoal: 20, rewards: true });
    expect(normalizeSettings({ dailyGoal: 1 }).dailyGoal).toBe(5);
    expect(normalizeSettings({ dailyGoal: 999 }).dailyGoal).toBe(200);
    expect(normalizeSettings({ dailyGoal: 35, rewards: false })).toMatchObject({
      dailyGoal: 35,
      rewards: false,
    });
  });
});
