import type { LoadedPack, NodeKind, TaxonomyNode } from './types.ts';
import { issue, type Issue } from './issues.ts';
import { compareLabels, compareStrings } from './normalize.ts';

/** Allowed parent kinds per node kind (SPEC 5.1). Domains are roots. */
const ALLOWED_PARENTS: Record<NodeKind, readonly NodeKind[]> = {
  domain: [],
  subject: ['domain'],
  branch: ['subject'],
  topic: ['subject', 'branch'],
};

export interface MergedTaxonomy {
  readonly nodes: ReadonlyMap<string, TaxonomyNode>;
  /** Packs that declare each node, for messages and the index. */
  readonly declaredBy: ReadonlyMap<string, readonly string[]>;
}

export function sameNode(a: TaxonomyNode, b: TaxonomyNode): boolean {
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.kind === b.kind &&
    a.parent === b.parent &&
    a.order === b.order
  );
}

/**
 * Sibling order: by `order` ascending, nodes without one after those with
 * one, then by label (ignoring case), then by ID so the result is stable.
 */
export function compareNodes(a: TaxonomyNode, b: TaxonomyNode): number {
  if (a.order !== undefined && b.order !== undefined && a.order !== b.order)
    return a.order - b.order;
  if ((a.order === undefined) !== (b.order === undefined)) return a.order === undefined ? 1 : -1;
  return compareLabels(a.label, b.label) || compareStrings(a.id, b.id);
}

/**
 * Merge all packs' taxonomy nodes into one tree and check its structure.
 * A node may be declared by several packs only if the declarations match.
 */
export function mergeTaxonomy(packs: readonly LoadedPack[]): {
  taxonomy: MergedTaxonomy;
  issues: Issue[];
} {
  const nodes = new Map<string, TaxonomyNode>();
  const declaredBy = new Map<string, string[]>();
  const issues: Issue[] = [];

  for (const pack of packs) {
    const file = `${pack.folder}/taxonomy.json`;
    const seenInPack = new Set<string>();
    for (const node of pack.taxonomy) {
      if (seenInPack.has(node.id)) {
        issues.push(
          err('taxonomy.duplicate-in-pack', file, `Node "${node.id}" is declared twice.`, node.id),
        );
        continue;
      }
      seenInPack.add(node.id);
      const existing = nodes.get(node.id);
      if (existing && !sameNode(existing, node)) {
        issues.push(
          err(
            'taxonomy.conflict',
            file,
            `Node "${node.id}" differs from its declaration in ${declaredBy.get(node.id)?.join(', ')}.`,
            node.id,
          ),
        );
        continue;
      }
      nodes.set(node.id, node);
      declaredBy.set(node.id, [...(declaredBy.get(node.id) ?? []), pack.folder]);
    }
  }

  for (const node of nodes.values()) {
    const where = `${declaredBy.get(node.id)?.[0] ?? '?'}/taxonomy.json`;
    if (node.kind === 'domain') {
      if (node.parent !== undefined) {
        issues.push(
          err('taxonomy.kind', where, `Domain "${node.id}" must not have a parent.`, node.id),
        );
      }
      continue;
    }
    if (node.parent === undefined) {
      issues.push(
        err('taxonomy.missing-parent', where, `${node.kind} "${node.id}" needs a parent.`, node.id),
      );
      continue;
    }
    const parent = nodes.get(node.parent);
    if (!parent) {
      issues.push(
        err(
          'taxonomy.missing-parent',
          where,
          `Parent "${node.parent}" of "${node.id}" does not exist.`,
          node.id,
        ),
      );
      continue;
    }
    if (!ALLOWED_PARENTS[node.kind].includes(parent.kind)) {
      issues.push(
        err(
          'taxonomy.kind',
          where,
          `A ${node.kind} ("${node.id}") cannot sit under a ${parent.kind} ("${parent.id}").`,
          node.id,
        ),
      );
    }
  }

  // Two siblings with the same order are ambiguous (label order breaks the tie).
  const byParent = new Map<string, TaxonomyNode[]>();
  for (const node of nodes.values()) {
    if (node.order === undefined) continue;
    const key = node.parent ?? '';
    byParent.set(key, [...(byParent.get(key) ?? []), node]);
  }
  for (const siblings of byParent.values()) {
    const firstWith = new Map<number, TaxonomyNode>();
    for (const node of siblings) {
      const other = node.order === undefined ? undefined : firstWith.get(node.order);
      if (other && node.order !== undefined) {
        issues.push(
          issue(
            'warning',
            'taxonomy.order-duplicate',
            `${declaredBy.get(node.id)?.[0] ?? '?'}/taxonomy.json`,
            `"${node.id}" and "${other.id}" share order ${node.order}; label order breaks the tie.`,
            node.id,
          ),
        );
      } else if (node.order !== undefined) {
        firstWith.set(node.order, node);
      }
    }
  }

  // Kind nesting already makes cycles impossible unless parents are wrong; guard anyway.
  for (const node of nodes.values()) {
    const seen = new Set<string>();
    let current: TaxonomyNode | undefined = node;
    while (current?.parent !== undefined) {
      if (seen.has(current.id)) {
        issues.push(err('taxonomy.cycle', 'taxonomy', `Cycle through "${node.id}".`, node.id));
        break;
      }
      seen.add(current.id);
      current = nodes.get(current.parent);
    }
  }

  return { taxonomy: { nodes, declaredBy }, issues };
}

/** Path of node IDs from the root down to (and including) the given node. */
export function pathTo(nodes: ReadonlyMap<string, TaxonomyNode>, id: string): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let current = nodes.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.id);
    current = current.parent === undefined ? undefined : nodes.get(current.parent);
  }
  return path;
}

function err(code: string, file: string, message: string, id?: string): Issue {
  return issue('error', code, file, message, id);
}
