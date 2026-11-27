import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import { compareLabels } from '../content/normalize.ts';
import { questionIdsUnder } from '../library/library.ts';
import type { Scheduler } from '../scheduler/scheduler.ts';
import type { CardState } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import { accuracyFrom, accuracyOf, recentByCard, type Accuracy } from './accuracy.ts';
import { coverageOf, masteryOf, type Mastery } from './retention.ts';

/** A topic is weak when its recent accuracy is below this... */
export const WEAK_ACCURACY = 0.7;
/** ...over at least this many recent answers. */
export const WEAK_MIN_ANSWERS = 3;

export interface MasteryStat extends Mastery {
  readonly coverage: number;
  /** Share of answers right in the last 30 days (the Stats headline). */
  readonly accuracy: Accuracy;
}

export interface TopicStat extends MasteryStat {
  readonly id: string;
  readonly label: string;
  readonly subjectId: string;
  readonly subjectLabel: string;
  readonly branchId?: string;
  /** Recent accuracy below WEAK_ACCURACY over at least WEAK_MIN_ANSWERS answers. */
  readonly weak: boolean;
}

export interface SubjectStat extends MasteryStat {
  readonly id: string;
  readonly label: string;
}

export interface Stats {
  readonly overall: MasteryStat;
  readonly subjects: readonly SubjectStat[];
  /** Topics with at least one verified question, in tree order. */
  readonly topics: readonly TopicStat[];
}

export interface StatsInput {
  readonly index: ContentIndex;
  readonly cards: ReadonlyMap<string, CardState>;
  readonly scheduler: Scheduler;
  readonly now: number;
  /** The review log, for recent accuracy. */
  readonly events: readonly ReviewEvent[];
}

/**
 * Mastery per subject and topic (SPEC 14.1) from the content index and the
 * replayed cards. Counts verified questions of every pack, active or not.
 */
export function buildStats(input: StatsInput): Stats {
  const { index, cards, scheduler, now, events } = input;
  const recent = recentByCard(events, now);
  const stat = (ids: readonly string[]): MasteryStat => {
    const m = masteryOf(ids, cards, scheduler, now);
    let answered = 0;
    let right = 0;
    for (const id of ids) {
      const r = recent.get(id);
      if (r) {
        answered += r.answered;
        right += r.right;
      }
    }
    return { ...m, coverage: coverageOf(m), accuracy: accuracyFrom(answered, right) };
  };

  const subjects: SubjectStat[] = [];
  const topics: TopicStat[] = [];
  const allIds: string[] = [];

  const visit = (
    node: IndexTreeNode,
    subject: IndexTreeNode | undefined,
    branch: IndexTreeNode | undefined,
  ): void => {
    if (node.kind === 'topic' && subject) {
      const ids = node.questionIds ?? [];
      if (ids.length === 0) return;
      const s = stat(ids);
      topics.push({
        ...s,
        id: node.id,
        label: node.label,
        subjectId: subject.id,
        subjectLabel: subject.label,
        ...(branch ? { branchId: branch.id } : {}),
        weak: s.accuracy.answered >= WEAK_MIN_ANSWERS && (s.accuracy.share ?? 1) < WEAK_ACCURACY,
      });
      return;
    }
    if (node.kind === 'subject') {
      const ids = questionIdsUnder(node);
      allIds.push(...ids);
      subjects.push({ ...stat(ids), id: node.id, label: node.label });
    }
    for (const child of node.children) {
      visit(
        child,
        node.kind === 'subject' ? node : subject,
        node.kind === 'branch' ? node : branch,
      );
    }
  };
  for (const root of index.tree) visit(root, undefined, undefined);

  // Overall accuracy counts every recent answer, retired questions included.
  return { overall: { ...stat(allIds), accuracy: accuracyOf(events, now) }, subjects, topics };
}

export type TopicSort = 'accuracy' | 'retention' | 'coverage';

/**
 * Started topics, weakest first (SPEC 14.1: sortable to reveal unevenness).
 * By accuracy, topics without recent answers come last.
 */
export function sortTopics(topics: readonly TopicStat[], by: TopicSort): TopicStat[] {
  const key = (t: TopicStat): number =>
    by === 'accuracy'
      ? (t.accuracy.share ?? Number.POSITIVE_INFINITY)
      : by === 'retention'
        ? (t.retention ?? 1)
        : t.coverage;
  return topics
    .filter((t) => t.started > 0)
    .sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka !== kb) return ka < kb ? -1 : 1;
      return compareLabels(a.label, b.label);
    });
}
