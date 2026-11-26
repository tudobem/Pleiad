import type { Question, Tier } from '../content/types.ts';
import { TIERS } from '../content/types.ts';
import { seededRandom, shuffle } from '../random.ts';
import { dayStartMs, learningDay, nextDayStartMs } from '../scheduler/day.ts';
import type { Settings } from '../settings.ts';
import type { CardState } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { interleaveBy } from './session.ts';

/** SPEC 7.2: the next tier of a topic unlocks at 80% of the previous tier introduced. */
export const UNLOCK_RATIO = 0.8;

export interface QueueInput {
  /** Verified questions of supported types. */
  readonly questions: readonly Question[];
  readonly cards: ReadonlyMap<string, CardState>;
  readonly events: readonly ReviewEvent[];
  readonly settings: Settings;
  readonly now: number;
  readonly offsetMinutes: number;
  /**
   * Restrict the picked items to these question IDs (Practice <Subject>).
   * Daily limits and tier unlock still count every question.
   */
  readonly scope?: ReadonlySet<string>;
}

export interface DailyQueue {
  readonly day: number;
  /** Due reviews in session order. */
  readonly due: readonly string[];
  /** New items in session order. */
  readonly fresh: readonly string[];
}

export const introduced = (cards: ReadonlyMap<string, CardState>, id: string): boolean =>
  cards.get(id)?.scheduler != null;

/**
 * The Daily queue (SPEC 7.5): due reviews first, then new items up to the
 * daily limit, interleaving subjects. Pure and deterministic for a given day.
 */
export function buildDailyQueue(input: QueueInput): DailyQueue {
  const { questions, cards, events, settings, now, offsetMinutes, scope } = input;
  const inScope = (q: Question): boolean => !scope || scope.has(q.id);
  const day = learningDay(now, offsetMinutes);
  const start = dayStartMs(day, offsetMinutes);
  const end = nextDayStartMs(now, offsetMinutes);
  const byId = new Map(questions.map((q) => [q.id, q]));

  // What already happened today.
  let introducedToday = 0;
  for (const card of cards.values()) {
    if (card.introducedTs !== null && card.introducedTs >= start && byId.has(card.cardId)) {
      introducedToday += 1;
    }
  }
  const reviewsToday = events.filter((e) => {
    if (e.mode !== 'scheduled' || e.ts < start) return false;
    const introducedTs = cards.get(e.cardId)?.introducedTs;
    return introducedTs !== null && introducedTs !== undefined && introducedTs < start;
  }).length;

  // Due reviews: most overdue first, soft cap per day.
  const dueCards = questions
    .filter(inScope)
    .map((q) => ({ q, s: cards.get(q.id)?.scheduler }))
    .filter((x): x is { q: Question; s: NonNullable<typeof x.s> } => !!x.s && x.s.due < end)
    .sort((a, b) => a.s.due - b.s.due || (a.q.id < b.q.id ? -1 : 1))
    .slice(0, Math.max(0, settings.reviewCap - reviewsToday))
    .map((x) => x.q);

  // New items.
  const limit = Math.max(0, settings.newPerDay - introducedToday);
  const candidates = questions.filter(
    (q) =>
      inScope(q) &&
      !introduced(cards, q.id) &&
      tierUnlocked(q, questions, cards, settings.autoUnlock) &&
      prerequisitesMet(q, byId, cards),
  );
  const random = seededRandom(day);
  const byTier = new Map<Tier, Question[]>(
    TIERS.map((t) => [
      t,
      shuffle(
        candidates.filter((q) => q.tier === t),
        random,
      ),
    ]),
  );
  const fresh = pickByTierMix(byTier, settings.tierMix, limit);

  return {
    day,
    due: mix(dueCards).map((q) => q.id),
    fresh: mix(fresh).map((q) => q.id),
  };
}

/** Interleave subjects and question types rather than blocking (SPEC 7.5). */
function mix(items: readonly Question[]): Question[] {
  return interleaveBy(
    interleaveBy(items, (q) => q.type),
    (q) => q.pack,
  );
}

/** Auto-unlock per topic (SPEC 7.2). Foundational is always available. */
export function tierUnlocked(
  q: Question,
  all: readonly Question[],
  cards: ReadonlyMap<string, CardState>,
  autoUnlock: boolean,
): boolean {
  if (q.tier === 'foundational') return true;
  if (!autoUnlock) return false;
  const ratio = (tier: Tier): number | null => {
    const items = all.filter((x) => x.topic === q.topic && x.tier === tier);
    if (items.length === 0) return null;
    return items.filter((x) => introduced(cards, x.id)).length / items.length;
  };
  const foundational = ratio('foundational');
  const advancedOpen = foundational === null || foundational >= UNLOCK_RATIO;
  if (q.tier === 'advanced') return advancedOpen;
  const advanced = ratio('advanced');
  return advancedOpen && (advanced === null || advanced >= UNLOCK_RATIO);
}

/** A prerequisite question must be introduced; a concept needs any introduced question using it. */
export function prerequisitesMet(
  q: Question,
  byId: ReadonlyMap<string, Question>,
  cards: ReadonlyMap<string, CardState>,
): boolean {
  return (q.prerequisites ?? []).every((ref) => {
    if (byId.has(ref) || cards.has(ref)) return introduced(cards, ref);
    for (const other of byId.values()) {
      if (other.concepts?.includes(ref) && introduced(cards, other.id)) return true;
    }
    return false;
  });
}

/**
 * Split `limit` new slots across tiers by weight (largest remainder), only
 * among tiers that still have candidates; slots a tier cannot fill flow to
 * the others.
 */
export function pickByTierMix<T>(
  byTier: ReadonlyMap<Tier, readonly T[]>,
  weights: Readonly<Record<Tier, number>>,
  limit: number,
): T[] {
  const remaining = new Map<Tier, T[]>([...byTier].map(([t, items]) => [t, [...items]]));
  const picked = new Map<Tier, T[]>(TIERS.map((t) => [t, []]));
  let slots = limit;
  while (slots > 0) {
    const open = TIERS.filter((t) => (remaining.get(t)?.length ?? 0) > 0 && weights[t] > 0);
    if (open.length === 0) break;
    const total = open.reduce((sum, t) => sum + weights[t], 0);
    const shares = open.map((t) => ({ t, exact: (slots * weights[t]) / total }));
    const alloc = new Map(shares.map(({ t, exact }) => [t, Math.floor(exact)]));
    let left = slots - [...alloc.values()].reduce((a, b) => a + b, 0);
    for (const { t } of [...shares].sort(
      (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)),
    )) {
      if (left === 0) break;
      alloc.set(t, (alloc.get(t) ?? 0) + 1);
      left -= 1;
    }
    let took = 0;
    for (const t of open) {
      const pool = remaining.get(t) ?? [];
      const take = pool.splice(0, alloc.get(t) ?? 0);
      picked.get(t)?.push(...take);
      took += take.length;
    }
    if (took === 0) break;
    slots -= took;
  }
  // Present foundational first within the new block; interleaving happens later.
  return TIERS.flatMap((t) => picked.get(t) ?? []);
}
