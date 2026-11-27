import type { IndexTreeNode } from '../content/contentIndex.ts';
import {
  questionIdsUnder,
  type Library,
  type LibraryNode,
  type LibrarySubject,
} from './library.ts';

/** A node of the content index tree by ID, searched depth first. */
export function findIndexNode(
  tree: readonly IndexTreeNode[],
  id: string,
): IndexTreeNode | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findIndexNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

/** Verified question IDs under a subject, branch or topic (empty if unknown). */
export function questionIdsFor(tree: readonly IndexTreeNode[], id: string): string[] {
  const node = findIndexNode(tree, id);
  return node ? questionIdsUnder(node) : [];
}

/** Where a drill target sits: its subject, plus the branch or topic row if it is one. */
export interface DrillTarget {
  readonly subject: LibrarySubject;
  readonly node?: LibraryNode;
}

/** Find a subject, branch or topic in the Library (DESIGN 4.5 rows). */
export function locateNode(library: Library, id: string): DrillTarget | undefined {
  for (const subject of library.subjects) {
    if (subject.id === id) return { subject };
    for (const branch of subject.children) {
      if (branch.id === id) return { subject, node: branch };
      const topic = branch.children.find((c) => c.id === id);
      if (topic) return { subject, node: topic };
    }
  }
  return undefined;
}
