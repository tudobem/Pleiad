import { describe, expect, it } from 'vitest';
import { buildContentIndex } from './contentIndex.ts';
import { mergeTaxonomy } from './taxonomy.ts';
import { countContent, formatReport } from './report.ts';
import { mcq, recall, pack, meta, NODES } from './fixtures.test-util.ts';

describe('buildContentIndex', () => {
  const a = pack([mcq(), recall({ status: 'verified', verified_on: '2026-02-01' })]);
  const b = pack([mcq({ id: 'b-0001', pack: 'b-pack', tier: 'advanced' })], {
    folder: 'b-pack',
    meta: meta({ id: 'b-pack', accent: 'link' }),
  });

  it('rolls counts up the tree and lists packs', () => {
    const { taxonomy } = mergeTaxonomy([a, b]);
    const index = buildContentIndex([a, b], taxonomy);
    expect(index.packs.map((p) => p.id)).toEqual(['b-pack', 'cons-pack']);
    const science = index.tree[0];
    expect(science?.id).toBe('science');
    expect(science?.counts.total).toBe(3);
    expect(science?.counts.byStatus.verified).toBe(1);
    expect(science?.packs).toEqual(['b-pack', 'cons-pack']);
    const iit = science?.children[0]?.children[0]?.children.find((n) => n.id === 'iit');
    expect(iit?.counts.total).toBe(2);
    expect(iit?.counts.byTier).toEqual({ foundational: 1, advanced: 1, expert: 0 });
  });

  it('is deterministic regardless of input order', () => {
    const one = buildContentIndex([a, b], mergeTaxonomy([a, b]).taxonomy);
    const two = buildContentIndex([b, a], mergeTaxonomy([b, a]).taxonomy);
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
  });

  it('formats a count report', () => {
    const text = formatReport(countContent([a, b]));
    expect(text).toContain('all packs');
    expect(text).toContain('cons-pack');
    expect(text).toMatch(/iit\s+2/);
  });
});

describe('content index order', () => {
  const topic = (id: string, label: string, order?: number) => ({
    id,
    label,
    kind: 'topic' as const,
    parent: 'theories',
    ...(order !== undefined ? { order } : {}),
  });
  const nodes = [
    ...NODES.filter((n) => n.kind !== 'topic'),
    topic('later', '2004 to 2025', 2),
    topic('earlier', 'Antiquity to Kant', 1),
    topic('plain-z', 'Zebra'),
    topic('plain-m', "meta-d' and metacognition"),
    topic('plain-a', 'Apple'),
  ];

  it('lists children by order first, then unordered ones by label ignoring case', () => {
    const p = pack([], { taxonomy: nodes });
    const index = buildContentIndex([p], mergeTaxonomy([p]).taxonomy);
    const theories = index.tree[0]?.children[0]?.children[0];
    expect(theories?.children.map((c) => c.id)).toEqual([
      'earlier',
      'later',
      'plain-a',
      'plain-m',
      'plain-z',
    ]);
    expect(theories?.children.map((c) => c.order)).toEqual([1, 2, undefined, undefined, undefined]);
    // Unordered nodes carry no `order` property at all.
    expect(theories?.children[2]).not.toHaveProperty('order');
    expect(theories?.children[0]).toHaveProperty('order', 1);
  });
});
