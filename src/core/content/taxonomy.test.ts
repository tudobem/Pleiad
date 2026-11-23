import { describe, expect, it } from 'vitest';
import { mergeTaxonomy, pathTo } from './taxonomy.ts';
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
