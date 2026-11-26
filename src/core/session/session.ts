import { shuffle, type Random } from '../random.ts';
import { clozeAnswers } from '../content/cloze.ts';
import { QUESTION_TYPES, type Question } from '../content/types.ts';

/** One question in a session. */
export interface SessionItem {
  readonly questionId: string;
  /**
   * The shuffled order shown on screen: layout[i] is the original index at
   * display position i (MCQ options, cloze chips, match right column, order
   * items). Empty for recall and short answers.
   */
  readonly layout: readonly number[];
}

export interface BuildSessionOptions {
  readonly size: number;
  readonly random: Random;
}

/** Question types sessions can present. */
export const SUPPORTED_TYPES: readonly Question['type'][] = QUESTION_TYPES;

/** Questions sessions can use: verified items of supported types (SPEC 5.4). */
export function sessionEligible(questions: readonly Question[]): Question[] {
  return questions.filter((q) => q.status === 'verified' && SUPPORTED_TYPES.includes(q.type));
}

/** How many things a question shuffles for display. */
function layoutSize(q: Question): number {
  switch (q.type) {
    case 'mcq':
      return q.options.length;
    case 'cloze':
      return clozeAnswers(q.text).length + (q.bank?.length ?? 0);
    case 'match':
      return q.pairs.length;
    case 'order':
      return q.items.length;
    case 'recall':
    case 'short':
      return 0;
  }
}

export function layoutFor(q: Question, random: Random): number[] {
  const identity = Array.from({ length: layoutSize(q) }, (_, i) => i);
  if (identity.length < 2) return identity;
  // Never present an order question already in the right order.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shuffled = shuffle(identity, random);
    if (q.type !== 'order' || shuffled.some((v, i) => v !== i)) return shuffled;
  }
  return [...identity.slice(1), identity[0] ?? 0];
}

/** Session items for question IDs in the given order, with fresh layouts. */
export function toSessionItems(
  ids: readonly string[],
  questions: ReadonlyMap<string, Question>,
  random: Random,
): SessionItem[] {
  return ids.flatMap((id) => {
    const q = questions.get(id);
    return q ? [{ questionId: id, layout: layoutFor(q, random) }] : [];
  });
}

/**
 * Pick up to `size` eligible questions, shuffled, then interleaved by pack and
 * type so consecutive items differ where possible (SPEC 7.5).
 */
export function buildSession(
  questions: readonly Question[],
  { size, random }: BuildSessionOptions,
): SessionItem[] {
  const picked = shuffle(sessionEligible(questions), random).slice(0, Math.max(0, size));
  return interleaveBy(
    interleaveBy(picked, (q) => q.type),
    (q) => q.pack,
  ).map((q) => ({
    questionId: q.id,
    layout: layoutFor(q, random),
  }));
}

/** Round-robin across groups, keeping each group's order. */
export function interleaveBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  const queues = [...groups.values()];
  const out: T[] = [];
  while (out.length < items.length) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next !== undefined) out.push(next);
    }
  }
  return out;
}
