import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import type { Tier } from '../content/types.ts';

const TIER_NAMES: readonly Tier[] = ['foundational', 'advanced', 'expert'];

export interface QuestionLookup {
  subjectOf(id: string): string | undefined;
  /** Subject label for display. */
  subjectLabel(subjectId: string): string | undefined;
  tierOf(id: string): Tier | undefined;
  topicOf(id: string): string | undefined;
}

/** Find a verified question's subject, tier and topic from the content index. */
export function questionLookup(index: ContentIndex): QuestionLookup {
  const subject = new Map<string, string>();
  const tier = new Map<string, Tier>();
  const topic = new Map<string, string>();
  const labels = new Map<string, string>();
  const visit = (node: IndexTreeNode, subjectId: string | undefined) => {
    const current = node.kind === 'subject' ? node.id : subjectId;
    if (node.kind === 'subject') labels.set(node.id, node.label);
    (node.questionIds ?? []).forEach((id, i) => {
      if (current) subject.set(id, current);
      tier.set(id, TIER_NAMES[(node.tiers?.[i] ?? 1) - 1] ?? 'foundational');
      topic.set(id, node.id);
    });
    for (const child of node.children) visit(child, current);
  };
  for (const root of index.tree) visit(root, undefined);
  return {
    subjectOf: (id) => subject.get(id),
    subjectLabel: (id) => labels.get(id),
    tierOf: (id) => tier.get(id),
    topicOf: (id) => topic.get(id),
  };
}
