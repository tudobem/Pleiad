import { describe, expect, it } from 'vitest';
import { dayStartMs, daysBetween, learningDay, nextDayStartMs } from './day.ts';

const utc = (iso: string) => Date.parse(iso);
const CET = 60; // UTC+1

describe('learning days (04:00 local boundary)', () => {
  it('switches day at 04:00 local, not midnight', () => {
    const before = learningDay(utc('2026-11-24T02:59:00Z'), CET); // 03:59 local
    const at = learningDay(utc('2026-11-24T03:00:00Z'), CET); // 04:00 local
    const evening = learningDay(utc('2026-11-23T22:30:00Z'), CET); // 23:30 local the day before
    expect(at).toBe(before + 1);
    expect(before).toBe(evening);
  });

  it('round-trips day starts and computes the next boundary', () => {
    const now = utc('2026-11-24T12:00:00Z');
    const day = learningDay(now, CET);
    expect(dayStartMs(day, CET)).toBe(utc('2026-11-24T03:00:00Z'));
    expect(nextDayStartMs(now, CET)).toBe(utc('2026-11-25T03:00:00Z'));
    expect(learningDay(dayStartMs(day, CET), CET)).toBe(day);
  });

  it('counts days between moments', () => {
    const a = utc('2026-11-24T20:00:00Z');
    expect(daysBetween(a, a + 3_600_000, CET)).toBe(0);
    expect(daysBetween(a, utc('2026-11-25T08:00:00Z'), CET)).toBe(1);
  });

  it('keeps stored UTC times valid across a time-zone change', () => {
    const due = utc('2026-11-25T10:00:00Z');
    // Same instant, viewed from CET and from New York (UTC-5): still a real day, never shifted by storage.
    expect(learningDay(due, CET)).toBe(learningDay(due, -300));
    expect(learningDay(utc('2026-11-25T08:30:00Z'), -300)).toBe(
      learningDay(utc('2026-11-24T20:00:00Z'), -300),
    );
  });
});
