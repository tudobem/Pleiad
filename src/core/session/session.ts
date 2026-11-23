import { shuffle, type Random } from '../random.ts';
import type { McqQuestion, Question } from '../content/types.ts';

/** One question in a session, with its options in display order. */
export interface SessionItem {
  readonly questionId: string;
  /** displayOrder[i] is the original option index shown at position i. */
  readonly displayOrder: readonly number[];
}

export interface BuildSessionOptions {
  readonly size: number;
  readonly random: Random;
}

/** Questions the M2 practice session can use: verified MCQs. */
export function sessionEligible(questions: readonly Question[]): McqQuestion[] {
  return questions.filter((q): q is McqQuestion => q.type === 'mcq' && q.status === 'verified');
}

/**
 * Pick up to `size` eligible questions, shuffled, then interleaved by pack so
 * consecutive items come from different subjects where possible (SPEC 7.5).
 * Options are shuffled per item (SPEC 6).
 */
export function buildSession(
  questions: readonly Question[],
  { size, random }: BuildSessionOptions,
): SessionItem[] {
  const picked = shuffle(sessionEligible(questions), random).slice(0, Math.max(0, size));
  return interleaveBy(picked, (q) => q.pack).map((q) => ({
    questionId: q.id,
    displayOrder: shuffle(
      q.options.map((_, i) => i),
      random,
    ),
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

export interface McqGrade {
  readonly correct: boolean;
  /** Original option index the user chose. */
  readonly chosenOption: number;
}

export function gradeMcq(
  question: McqQuestion,
  item: SessionItem,
  chosenDisplayIndex: number,
): McqGrade {
  const chosenOption = item.displayOrder[chosenDisplayIndex];
  if (chosenOption === undefined) {
    throw new RangeError(`No option at display position ${chosenDisplayIndex}`);
  }
  return { correct: chosenOption === question.answer, chosenOption };
}
