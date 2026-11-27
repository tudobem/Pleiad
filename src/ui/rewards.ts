import { useMemo } from 'preact/hooks';
import { buildRewards, type Rewards } from '../core/gamification/rewards.ts';
import type { LearningData } from './learning.ts';
import { useServices } from './services.ts';

/** Goal, streak, XP and badges for the current moment (SPEC 15). Read only. */
export function useRewards(data: LearningData): Rewards {
  const { clock } = useServices();
  return useMemo(() => {
    const now = clock.now();
    return buildRewards({
      events: data.events,
      index: data.index,
      cards: data.cards,
      scheduler: data.scheduler,
      now,
      offsetMinutes: clock.utcOffsetMinutes(now),
      dailyGoal: data.settings.dailyGoal,
    });
    // data.events grows in place during a session; its length keeps this fresh.
  }, [clock, data, data.events.length]);
}
