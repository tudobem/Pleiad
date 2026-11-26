import { describe, expect, it } from 'vitest';
import { compareNodes, mergeTaxonomy, pathTo } from './taxonomy.ts';
import { NODES, pack } from './fixtures.test-util.ts';
import type { TaxonomyNode } from './types.ts';

const withNodes = (taxonomy: TaxonomyNode[], folder = 'cons-pack') =>
  pack([], { folder, taxonomy });
const codes = (...packs: ReturnType<typeof withNodes>[]) =>
  mergeTaxonomy(packs).issues.map((i) => i.code);

describe('mergeTaxonomy', () => {
  it('accepts a well-formed tree', () => {
    expect(codes(withNodes(NODES))).toEqual([]);
  });

  it('merges identical declarations and rejects conflicting ones', () => {
    expect(codes(withNodes(NODES), withNodes(NODES, 'b'))).toEqual([]);
    const relabeled = NODES.map((n) => (n.id === 'science' ? { ...n, label: 'Sciences' } : n));
    expect(codes(withNodes(NODES), withNodes(relabeled, 'b'))).toContain('taxonomy.conflict');
  });

  it('rejects duplicates within one pack', () => {
    expect(codes(withNodes([...NODES, NODES[0] as TaxonomyNode]))).toContain(
      'taxonomy.duplicate-in-pack',
    );
  });

  it('enforces kind nesting and parents', () => {
    const topicUnderDomain: TaxonomyNode = {
      id: 'x',
      label: 'X',
      kind: 'topic',
      parent: 'science',
    };
    expect(codes(withNodes([...NODES, topicUnderDomain]))).toContain('taxonomy.kind');
    const orphan: TaxonomyNode = { id: 'y', label: 'Y', kind: 'topic', parent: 'missing' };
    expect(codes(withNodes([...NODES, orphan]))).toContain('taxonomy.missing-parent');
    const noParent: TaxonomyNode = { id: 'z', label: 'Z', kind: 'subject' };
    expect(codes(withNodes([...NODES, noParent]))).toContain('taxonomy.missing-parent');
    const domainWithParent: TaxonomyNode = {
      id: 'd',
      label: 'D',
      kind: 'domain',
      parent: 'science',
    };
    expect(codes(withNodes([...NODES, domainWithParent]))).toContain('taxonomy.kind');
  });

  it('allows topics directly under a subject', () => {
    const t: TaxonomyNode = { id: 't', label: 'T', kind: 'topic', parent: 'cons' };
    expect(codes(withNodes([...NODES, t]))).toEqual([]);
  });

  it('computes root-down paths', () => {
    const { taxonomy } = mergeTaxonomy([withNodes(NODES)]);
    expect(pathTo(taxonomy.nodes, 'iit')).toEqual(['science', 'cons', 'theories', 'iit']);
  });
});

describe('taxonomy order', () => {
  const node = (id: string, label: string, order?: number): TaxonomyNode => ({
    id,
    label,
    kind: 'topic',
    parent: 'cons',
    ...(order !== undefined ? { order } : {}),
  });

  it('sorts by order, then unordered nodes by label ignoring case, then id', () => {
    const nodes = [
      node('z', 'Zeta'),
      node('m', "meta-d' and metacognition"),
      node('b', 'Beta', 2),
      node('a', 'Alpha', 10),
      node('c', 'Gamma', 1),
      node('b2', 'beta'),
    ];
    expect(nodes.sort(compareNodes).map((n) => n.id)).toEqual(['c', 'b', 'a', 'b2', 'm', 'z']);
  });

  it('requires shared nodes to agree on order', () => {
    const ordered = NODES.map((n) => (n.id === 'iit' ? { ...n, order: 2 } : n));
    expect(codes(withNodes(NODES), withNodes(ordered, 'b'))).toContain('taxonomy.conflict');
    expect(codes(withNodes(ordered), withNodes(ordered, 'b'))).toEqual([]);
  });

  it('warns when siblings share an order, but not across different parents', () => {
    const dup = NODES.map((n) => (n.id === 'iit' || n.id === 'gwt' ? { ...n, order: 1 } : n));
    const result = mergeTaxonomy([withNodes(dup)]).issues;
    expect(result.map((i) => `${i.level}:${i.code}`)).toEqual(['warning:taxonomy.order-duplicate']);
    const apart = NODES.map((n) =>
      n.id === 'iit' ? { ...n, order: 1 } : n.id === 'theories' ? { ...n, order: 1 } : n,
    );
    expect(mergeTaxonomy([withNodes(apart)]).issues).toEqual([]);
  });
});
