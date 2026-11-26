import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import { compareLabels } from '../content/normalize.ts';
import { questionIdsUnder } from '../library/library.ts';
import type { Scheduler } from '../scheduler/scheduler.ts';
import type { CardState } from '../sync/replay.ts';
import { coverageOf, masteryOf, type Mastery } from './retention.ts';

/** A topic is weak when its retention is this far below the desired retention. */
export const WEAK_MARGIN = 0.05;

export interface MasteryStat extends Mastery {
  readonly coverage: number;
}

export interface TopicStat extends MasteryStat {
  readonly id: string;
  readonly label: string;
  readonly subjectId: string;
  readonly subjectLabel: string;
  readonly branchId?: string;
  /** Retention below the desired retention by more than WEAK_MARGIN. */
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
  readonly desiredRetention: number;
}

/**
 * Mastery per subject and topic (SPEC 14.1) from the content index and the
 * replayed cards. Counts verified questions of every pack, active or not.
 */
export function buildStats(input: StatsInput): Stats {
  const { index, cards, scheduler, now, desiredRetention } = input;
  const stat = (ids: readonly string[]): MasteryStat => {
    const m = masteryOf(ids, cards, scheduler, now);
    return { ...m, coverage: coverageOf(m) };
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
        weak: s.retention !== null && s.retention < desiredRetention - WEAK_MARGIN,
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

  return { overall: stat(allIds), subjects, topics };
}

export type TopicSort = 'retention' | 'coverage';

/** Started topics, weakest first (SPEC 14.1: sortable to reveal unevenness). */
export function sortTopics(topics: readonly TopicStat[], by: TopicSort): TopicStat[] {
  const key = (t: TopicStat): number => (by === 'retention' ? (t.retention ?? 1) : t.coverage);
  return topics
    .filter((t) => t.started > 0)
    .sort((a, b) => key(a) - key(b) || compareLabels(a.label, b.label));
}
