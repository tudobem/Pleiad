import type { Question, Tier } from '../content/types.ts';
import { shuffle, type Random } from '../random.ts';
import { DAY_MS, nextDayStartMs } from '../scheduler/day.ts';
import type { Scheduler } from '../scheduler/scheduler.ts';
import type { CardState } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { WEAK_WINDOW_DAYS, weakSpots } from '../analytics/weakSpots.ts';
import { interleaveBy, layoutFor, sessionEligible, type SessionItem } from './session.ts';

/** Drill lengths (SPEC 8): a number of questions, or every match. */
export const DRILL_SIZES = [10, 20, 'all'] as const;
export type DrillSize = (typeof DRILL_SIZES)[number];
export const DEFAULT_DRILL_SIZE: DrillSize = 10;

/** Tag authors put on contrast items (SPEC 10.3). */
export const CONTRAST_TAG = 'contrast';

export interface DrillInput {
  /** Questions that can be drilled (the active packs). */
  readonly questions: ReadonlyMap<string, Question>;
  readonly cards: ReadonlyMap<string, CardState>;
  readonly events: readonly ReviewEvent[];
  readonly scheduler: Scheduler;
  readonly now: number;
  readonly offsetMinutes: number;
  readonly random: Random;
  readonly size: DrillSize;
}

/** Topic drill filter (SPEC 8.2): question IDs of a subject, branch or topic, plus tier and tag. */
export interface TopicFilter {
  /** IDs under the chosen node; unset means every drillable question. */
  readonly scope?: ReadonlySet<string>;
  readonly tier?: Tier;
  readonly tag?: string;
}

const limitOf = (size: DrillSize): number => (size === 'all' ? Infinity : size);

/** Whether a card is due before the next 04:00 day boundary. */
export function dueToday(
  cards: ReadonlyMap<string, CardState>,
  id: string,
  now: number,
  offsetMinutes: number,
): boolean {
  const s = cards.get(id)?.scheduler;
  return !!s && s.due < nextDayStartMs(now, offsetMinutes);
}

/**
 * Session items for a drill. An item due today is a scheduled review (it
 * steps FSRS and leaves the Daily queue); every other item is extra practice
 * and never changes FSRS (SPEC 7.6, 8.2).
 */
export function drillItems(
  ids: readonly string[],
  input: Pick<DrillInput, 'questions' | 'cards' | 'now' | 'offsetMinutes' | 'random'>,
): SessionItem[] {
  return ids.flatMap((id) => {
    const q = input.questions.get(id);
    if (!q) return [];
    const mode = dueToday(input.cards, id, input.now, input.offsetMinutes) ? 'scheduled' : 'extra';
    return [{ questionId: id, layout: layoutFor(q, input.random), mode }];
  });
}

/** Drillable questions matching a topic filter. */
export function topicMatches(
  questions: ReadonlyMap<string, Question>,
  filter: TopicFilter,
): Question[] {
  return sessionEligible([...questions.values()]).filter(
    (q) =>
      (!filter.scope || filter.scope.has(q.id)) &&
      (!filter.tier || q.tier === filter.tier) &&
      (!filter.tag || (q.tags ?? []).includes(filter.tag)),
  );
}

/**
 * Topic drill (SPEC 8.2): due items first, then started items weakest first
 * (lowest retrievability), then items not started yet, shuffled within each
 * band; cut to size and interleaved by question type.
 */
export function topicDrill(input: DrillInput, filter: TopicFilter): SessionItem[] {
  const { cards, scheduler, now, offsetMinutes, random } = input;
  const matches = shuffle(topicMatches(input.questions, filter), random);
  const due: Question[] = [];
  const started: { q: Question; r: number }[] = [];
  const fresh: Question[] = [];
  for (const q of matches) {
    const s = cards.get(q.id)?.scheduler;
    if (!s) fresh.push(q);
    else if (dueToday(cards, q.id, now, offsetMinutes)) due.push(q);
    else started.push({ q, r: scheduler.retrievability(s, now) });
  }
  started.sort((a, b) => a.r - b.r);
  const picked = [...due, ...started.map((x) => x.q), ...fresh].slice(0, limitOf(input.size));
  const ordered = interleaveBy(picked, (q) => q.type);
  return drillItems(
    ordered.map((q) => q.id),
    input,
  );
}

/** Weak-spot mode (SPEC 8.3): the weak-spot list, strongest signal first. */
export function weakSpotDrill(input: DrillInput): SessionItem[] {
  const spots = weakSpots({
    questions: new Map(sessionEligible([...input.questions.values()]).map((q) => [q.id, q])),
    cards: input.cards,
    events: input.events,
    scheduler: input.scheduler,
    now: input.now,
    limit: limitOf(input.size),
  });
  return drillItems(
    spots.map((s) => s.questionId),
    input,
  );
}

/** Two questions linked by `confusable_with` (either direction), in ID order. */
export interface ConfusablePair {
  readonly a: string;
  readonly b: string;
}

/** Every pair whose two ends are both drillable, each pair once. */
export function confusablePairs(questions: ReadonlyMap<string, Question>): ConfusablePair[] {
  const eligible = new Map(sessionEligible([...questions.values()]).map((q) => [q.id, q]));
  const seen = new Set<string>();
  const pairs: ConfusablePair[] = [];
  for (const q of eligible.values()) {
    for (const other of q.confusable_with ?? []) {
      if (other === q.id || !eligible.has(other)) continue;
      const [a, b] = q.id < other ? [q.id, other] : [other, q.id];
      const key = `${a}\n${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a, b });
    }
  }
  return pairs.sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : x.b < y.b ? -1 : 1));
}

/**
 * Confusable-pair drill (SPEC 8.4, 10.3): linked pairs back to back, pairs
 * with recent misses on either side first (others shuffled), then items
 * tagged `contrast` that are not in a pair yet. Each question appears once.
 */
export function confusableDrill(input: DrillInput): SessionItem[] {
  const since = input.now - WEAK_WINDOW_DAYS * DAY_MS;
  const misses = new Map<string, number>();
  for (const e of input.events) {
    if (!e.correct && e.ts >= since && e.ts <= input.now) {
      misses.set(e.cardId, (misses.get(e.cardId) ?? 0) + 1);
    }
  }
  const missesOf = (p: ConfusablePair) => (misses.get(p.a) ?? 0) + (misses.get(p.b) ?? 0);
  const pairs = shuffle(confusablePairs(input.questions), input.random)
    .map((p, i) => ({ p, i, m: missesOf(p) }))
    .sort((x, y) => y.m - x.m || x.i - y.i);

  const limit = limitOf(input.size);
  const ids: string[] = [];
  const used = new Set<string>();
  for (const { p } of pairs) {
    if (ids.length >= limit) break;
    // Show the one missed more first, so its partner is the contrast.
    const pair = (misses.get(p.b) ?? 0) > (misses.get(p.a) ?? 0) ? [p.b, p.a] : [p.a, p.b];
    for (const id of pair) {
      if (!used.has(id) && ids.length < limit) {
        used.add(id);
        ids.push(id);
      }
    }
  }
  const contrast = shuffle(
    sessionEligible([...input.questions.values()]).filter(
      (q) => !used.has(q.id) && (q.tags ?? []).includes(CONTRAST_TAG),
    ),
    input.random,
  );
  for (const q of contrast) {
    if (ids.length >= limit) break;
    ids.push(q.id);
  }
  return drillItems(ids, input);
}

/** How many questions a confusable drill can draw from (pairs plus contrast items). */
export function confusableCount(questions: ReadonlyMap<string, Question>): {
  pairs: number;
  questions: number;
} {
  const pairs = confusablePairs(questions);
  const ids = new Set(pairs.flatMap((p) => [p.a, p.b]));
  for (const q of sessionEligible([...questions.values()])) {
    if ((q.tags ?? []).includes(CONTRAST_TAG)) ids.add(q.id);
  }
  return { pairs: pairs.length, questions: ids.size };
}
