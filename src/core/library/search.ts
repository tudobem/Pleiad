import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import { compareLabels, normalizeText } from '../content/normalize.ts';
import type { NodeKind } from '../content/types.ts';

export interface SearchResult {
  readonly id: string;
  readonly label: string;
  readonly kind: NodeKind;
  /** Subject page to open. */
  readonly subjectId: string;
  /** Branch to expand on the subject page, if any. */
  readonly branchId?: string;
  /** Labels from the subject down to the node's parent. */
  readonly path: readonly string[];
  /** Set when the match came from a tag rather than the label. */
  readonly tag?: string;
}

export const SEARCH_LIMIT = 20;

const DEPTH: Record<NodeKind, number> = { domain: 0, subject: 1, branch: 2, topic: 3 };

/** Every query word must start some word of the text (case and accents ignored). */
function matches(queryWords: readonly string[], text: string): boolean {
  const words = normalizeText(text).split(' ');
  return queryWords.every((q) => words.some((w) => w.startsWith(q)));
}

/**
 * Search subjects, branches and topics by label and topic tags (SPEC 12).
 * Label matches rank before tag matches, then shallower nodes first.
 */
export function searchLibrary(index: ContentIndex, query: string): SearchResult[] {
  const queryWords = normalizeText(query).split(' ').filter(Boolean);
  if (queryWords.length === 0) return [];
  const found: { result: SearchResult; rank: number }[] = [];

  const visit = (node: IndexTreeNode, ancestors: readonly IndexTreeNode[]): void => {
    const subject = node.kind === 'subject' ? node : ancestors.find((a) => a.kind === 'subject');
    if (subject) {
      const branch = node.kind === 'branch' ? node : ancestors.find((a) => a.kind === 'branch');
      const path = ancestors.filter((a) => DEPTH[a.kind] >= DEPTH.subject).map((a) => a.label);
      const base = {
        id: node.id,
        label: node.label,
        kind: node.kind,
        subjectId: subject.id,
        ...(branch ? { branchId: branch.id } : {}),
        path,
      };
      if (matches(queryWords, node.label)) {
        found.push({ result: base, rank: DEPTH[node.kind] });
      } else {
        const tag = (node.tags ?? []).find((t) => matches(queryWords, t));
        if (tag !== undefined)
          found.push({ result: { ...base, tag }, rank: 10 + DEPTH[node.kind] });
      }
    }
    for (const child of node.children) visit(child, [...ancestors, node]);
  };
  for (const root of index.tree) visit(root, []);

  return found
    .sort((a, b) => a.rank - b.rank || compareLabels(a.result.label, b.result.label))
    .slice(0, SEARCH_LIMIT)
    .map((f) => f.result);
}
