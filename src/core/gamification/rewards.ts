import { calibratedWeeks } from '../analytics/calibration.ts';
import { masteryOf } from '../analytics/retention.ts';
import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import { questionIdsUnder } from '../library/library.ts';
import { learningDay } from '../scheduler/day.ts';
import type { Scheduler } from '../scheduler/scheduler.ts';
import { introduced } from '../session/dailyQueue.ts';
import type { CardState } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { badgeStates, type BadgeId } from './badges.ts';
import { challengeProgress, completedChallenges, type ChallengeProgress } from './challenges.ts';
import {
  answersPerDay,
  goalProgress,
  goalStreak,
  weekOf,
  type GoalProgress,
  type GoalStreak,
} from './goal.ts';
import { levelFor, subjectTitle, xpForEvents, type Level } from './xp.ts';

/** Bright Star badge: a subject with this many started items... */
export const BRIGHT_MIN_STARTED = 20;
/** ...at this retention or better. */
export const BRIGHT_RETENTION = 0.8;

export interface RewardsInput {
  readonly events: readonly ReviewEvent[];
  readonly index: ContentIndex;
  readonly cards: ReadonlyMap<string, CardState>;
  readonly scheduler: Scheduler;
  readonly now: number;
  readonly offsetMinutes: number;
  readonly dailyGoal: number;
}

export interface SubjectReward {
  readonly id: string;
  readonly label: string;
  readonly xp: number;
  readonly title: string;
}

export interface Rewards {
  readonly goal: GoalProgress;
  readonly streak: GoalStreak;
  readonly xp: number;
  readonly level: Level;
  readonly challenge: ChallengeProgress;
  readonly badges: readonly { readonly id: BadgeId; readonly earned: boolean }[];
  readonly subjects: readonly SubjectReward[];
}

interface IndexMaps {
  readonly tier: Map<string, number>;
  readonly topic: Map<string, string>;
  readonly subjects: IndexTreeNode[];
}

function indexMaps(index: ContentIndex): IndexMaps {
  const tier = new Map<string, number>();
  const topic = new Map<string, string>();
  const subjects: IndexTreeNode[] = [];
  const visit = (node: IndexTreeNode) => {
    if (node.kind === 'subject') subjects.push(node);
    (node.questionIds ?? []).forEach((id, i) => {
      tier.set(id, node.tiers?.[i] ?? 1);
      topic.set(id, node.id);
    });
    node.children.forEach(visit);
  };
  index.tree.forEach(visit);
  return { tier, topic, subjects };
}

/**
 * Goal, streak, XP, level, weekly challenge, badges and subject titles
 * (SPEC 15), all derived from the review log and the content index. Read
 * only: nothing here feeds back into scheduling or ratings.
 */
export function buildRewards(input: RewardsInput): Rewards {
  const { events, index, cards, scheduler, now, offsetMinutes, dailyGoal } = input;
  const maps = indexMaps(index);
  const today = learningDay(now, offsetMinutes);
  const perDay = answersPerDay(events, offsetMinutes);
  const streak = goalStreak(perDay, today, dailyGoal);

  const xpResult = xpForEvents(events, (id) => maps.tier.get(id) ?? 1);
  const ctx = {
    offsetMinutes,
    goal: dailyGoal,
    topicOf: (id: string) => maps.topic.get(id),
    recoveries: xpResult.recoveries,
  };
  const week = weekOf(today);
  const done = completedChallenges(events, week, ctx);
  const xp = xpResult.total + done.reduce((sum, c) => sum + c.reward, 0);

  const subjects = maps.subjects.map((node) => {
    const ids = questionIdsUnder(node);
    const subjectXp = ids.reduce((sum, id) => sum + (xpResult.byCard.get(id) ?? 0), 0);
    return { node, ids, xp: subjectXp };
  });

  const topicsStarted = new Set(
    [...cards.keys()].filter((id) => introduced(cards, id)).map((id) => maps.topic.get(id)),
  );
  topicsStarted.delete(undefined);

  const badges = badgeStates({
    answers: events.length,
    longestGoalStreak: streak.longest,
    recoveredCards: new Set(xpResult.recoveries.map((e) => e.cardId)).size,
    topicsStarted: topicsStarted.size,
    brightSubject: subjects.some(({ ids }) => {
      const m = masteryOf(ids, cards, scheduler, now);
      return m.started >= BRIGHT_MIN_STARTED && (m.retention ?? 0) >= BRIGHT_RETENTION;
    }),
    challengesDone: done.length,
    calibratedWeeks: calibratedWeeks(events, offsetMinutes).length,
  });

  return {
    goal: goalProgress(perDay, today, dailyGoal),
    streak,
    xp,
    level: levelFor(xp),
    challenge: challengeProgress(events, week, ctx),
    badges,
    subjects: subjects.map(({ node, xp: subjectXp }) => ({
      id: node.id,
      label: node.label,
      xp: subjectXp,
      title: subjectTitle(subjectXp),
    })),
  };
}

/** XP earned by a set of answers (the session done screen), without challenge rewards. */
export function sessionXp(
  allEvents: readonly ReviewEvent[],
  sessionEventIds: ReadonlySet<string>,
  index: ContentIndex,
): number {
  const { tier } = indexMaps(index);
  const result = xpForEvents(allEvents, (id) => tier.get(id) ?? 1);
  // Recompute per event: XP of the session's own answers, with their context.
  const before = xpForEvents(
    allEvents.filter((e) => !sessionEventIds.has(e.eventId)),
    (id) => tier.get(id) ?? 1,
  );
  return result.total - before.total;
}
