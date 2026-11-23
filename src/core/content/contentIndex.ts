import { compareStrings } from './normalize.ts';
import { pathTo, type MergedTaxonomy } from './taxonomy.ts';
import { addToCounts, emptyCounts, type Counts } from './report.ts';
import type { LoadedPack, NodeKind } from './types.ts';

/** Bump when the shape of content-index.json changes. */
export const CONTENT_INDEX_VERSION = 1;

export interface IndexTreeNode {
  readonly id: string;
  readonly label: string;
  readonly kind: NodeKind;
  readonly packs: readonly string[];
  readonly counts: Counts;
  readonly children: readonly IndexTreeNode[];
}

export interface IndexPack {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly language: string;
  readonly license: string;
  readonly accent: string;
  readonly domainPath: readonly string[];
  readonly bytes: number;
  readonly topics: readonly string[];
  readonly counts: Counts;
}

export interface ContentIndex {
  readonly version: number;
  readonly packs: readonly IndexPack[];
  readonly tree: readonly IndexTreeNode[];
}

/**
 * Build the small index loaded at startup (SPEC 5.3): taxonomy tree with
 * counts rolled up to every level, and per-pack metadata. Deterministic:
 * everything is sorted and no timestamps are included.
 */
export function buildContentIndex(
  packs: readonly LoadedPack[],
  taxonomy: MergedTaxonomy,
): ContentIndex {
  const countsByNode = new Map<string, Counts>();
  for (const id of taxonomy.nodes.keys()) countsByNode.set(id, emptyCounts());

  const indexPacks: IndexPack[] = [];
  for (const pack of [...packs].sort((a, b) => compareStrings(a.meta.id, b.meta.id))) {
    const counts = emptyCounts();
    const topics = new Set<string>();
    for (const qf of pack.questionFiles) {
      for (const q of qf.questions) {
        addToCounts(counts, q);
        topics.add(q.topic);
        // Roll the question up to the topic and every ancestor.
        for (const nodeId of pathTo(taxonomy.nodes, q.topic)) {
          const c = countsByNode.get(nodeId);
          if (c) addToCounts(c, q);
        }
      }
    }
    const { meta } = pack;
    indexPacks.push({
      id: meta.id,
      title: meta.title,
      description: meta.description,
      version: meta.version,
      language: meta.language,
      license: meta.license,
      accent: meta.accent,
      domainPath: meta.domainPath,
      bytes: pack.bytes,
      topics: [...topics].sort(),
      counts,
    });
  }

  const children = new Map<string | undefined, string[]>();
  for (const node of taxonomy.nodes.values()) {
    const list = children.get(node.parent) ?? [];
    list.push(node.id);
    children.set(node.parent, list);
  }

  const build = (id: string): IndexTreeNode => {
    const node = taxonomy.nodes.get(id);
    if (!node) throw new Error(`Unknown taxonomy node ${id}`);
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      packs: [...(taxonomy.declaredBy.get(id) ?? [])].sort(),
      counts: countsByNode.get(id) ?? emptyCounts(),
      children: (children.get(id) ?? []).sort(byLabel(taxonomy)).map(build),
    };
  };

  return {
    version: CONTENT_INDEX_VERSION,
    packs: indexPacks,
    tree: (children.get(undefined) ?? []).sort(byLabel(taxonomy)).map(build),
  };
}

function byLabel(taxonomy: MergedTaxonomy) {
  return (a: string, b: string): number =>
    compareStrings(taxonomy.nodes.get(a)?.label ?? a, taxonomy.nodes.get(b)?.label ?? b) ||
    compareStrings(a, b);
}
