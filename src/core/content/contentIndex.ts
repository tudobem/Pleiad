import { compareStrings } from './normalize.ts';
import { compareNodes, pathTo, type MergedTaxonomy } from './taxonomy.ts';
import { addToCounts, emptyCounts, type Counts } from './report.ts';
import type { LoadedPack, NodeKind, Tier } from './types.ts';

/** Tier as a number (XP weight, SPEC 15). */
export const TIER_LEVEL: Readonly<Record<Tier, number>> = {
  foundational: 1,
  advanced: 2,
  expert: 3,
};

/** Bump when the shape of content-index.json changes. */
export const CONTENT_INDEX_VERSION = 4;

export interface IndexTreeNode {
  readonly id: string;
  readonly label: string;
  readonly kind: NodeKind;
  /** The node's `order` from the taxonomy, if it has one. Children are already sorted by it. */
  readonly order?: number;
  readonly packs: readonly string[];
  readonly counts: Counts;
  /** Topics only: IDs of verified questions, sorted (progress without loading packs). */
  readonly questionIds?: readonly string[];
  /** Topics only: tier of each verified question (1 foundational, 2 advanced, 3 expert), aligned with questionIds. */
  readonly tiers?: readonly number[];
  /** Topics only: tags of the topic's verified questions, sorted (search). */
  readonly tags?: readonly string[];
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
  /** Path of the pack's verified-questions file, relative to `content/`. */
  readonly file: string;
  /** Drafts for in-app review (M14): fetched only by the review screen, never kept offline. */
  readonly draftsFile?: string;
  readonly draftCount?: number;
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
  files: Readonly<Record<string, string>> = {},
  drafts: Readonly<Record<string, { readonly file: string; readonly count: number }>> = {},
): ContentIndex {
  const countsByNode = new Map<string, Counts>();
  const idsByTopic = new Map<string, string[]>();
  const tierById = new Map<string, number>();
  const tagsByTopic = new Map<string, Set<string>>();
  for (const id of taxonomy.nodes.keys()) countsByNode.set(id, emptyCounts());

  const indexPacks: IndexPack[] = [];
  for (const pack of [...packs].sort((a, b) => compareStrings(a.meta.id, b.meta.id))) {
    const counts = emptyCounts();
    const topics = new Set<string>();
    for (const qf of pack.questionFiles) {
      for (const q of qf.questions) {
        addToCounts(counts, q);
        topics.add(q.topic);
        if (q.status === 'verified') {
          idsByTopic.set(q.topic, [...(idsByTopic.get(q.topic) ?? []), q.id]);
          tierById.set(q.id, TIER_LEVEL[q.tier]);
          const tags = tagsByTopic.get(q.topic) ?? new Set<string>();
          for (const tag of q.tags) tags.add(tag);
          tagsByTopic.set(q.topic, tags);
        }
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
      file: files[meta.id] ?? `packs/${meta.id}.json`,
      ...draftEntry(drafts[meta.id]),
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

  const sortedIds = (topic: string): string[] =>
    [...(idsByTopic.get(topic) ?? [])].sort(compareStrings);

  const build = (id: string): IndexTreeNode => {
    const node = taxonomy.nodes.get(id);
    if (!node) throw new Error(`Unknown taxonomy node ${id}`);
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      ...(node.order !== undefined ? { order: node.order } : {}),
      packs: [...(taxonomy.declaredBy.get(id) ?? [])].sort(),
      counts: countsByNode.get(id) ?? emptyCounts(),
      ...(node.kind === 'topic'
        ? {
            questionIds: sortedIds(id),
            tiers: sortedIds(id).map((q) => tierById.get(q) ?? 1),
            tags: [...(tagsByTopic.get(id) ?? [])].sort(compareStrings),
          }
        : {}),
      children: (children.get(id) ?? []).sort(bySiblingOrder(taxonomy)).map(build),
    };
  };

  return {
    version: CONTENT_INDEX_VERSION,
    packs: indexPacks,
    tree: (children.get(undefined) ?? []).sort(bySiblingOrder(taxonomy)).map(build),
  };
}

function bySiblingOrder(taxonomy: MergedTaxonomy) {
  return (a: string, b: string): number => {
    const na = taxonomy.nodes.get(a);
    const nb = taxonomy.nodes.get(b);
    return na && nb ? compareNodes(na, nb) : compareStrings(a, b);
  };
}

const draftEntry = (
  d: { readonly file: string; readonly count: number } | undefined,
): { draftsFile?: string; draftCount?: number } =>
  d ? { draftsFile: d.file, draftCount: d.count } : {};
