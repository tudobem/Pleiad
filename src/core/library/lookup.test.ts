import { describe, expect, it } from 'vitest';
import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import { emptyCounts } from '../content/report.ts';
import { questionLookup } from './lookup.ts';

const node = (
  id: string,
  kind: IndexTreeNode['kind'],
  children: IndexTreeNode[] = [],
  extra: Partial<IndexTreeNode> = {},
): IndexTreeNode => ({
  id,
  label: `${id} label`,
  kind,
  packs: [],
  counts: emptyCounts(),
  children,
  ...extra,
});

describe('questionLookup', () => {
  it('finds subject, tier and topic of verified questions', () => {
    const index: ContentIndex = {
      version: 4,
      packs: [],
      tree: [
        node('d', 'domain', [
          node('s', 'subject', [
            node('b', 'branch', [
              node('t', 'topic', [], { questionIds: ['q1', 'q2'], tiers: [1, 3] }),
            ]),
          ]),
        ]),
      ],
    };
    const l = questionLookup(index);
    expect([l.subjectOf('q1'), l.tierOf('q1'), l.tierOf('q2'), l.topicOf('q2')]).toEqual([
      's',
      'foundational',
      'expert',
      't',
    ]);
    expect(l.subjectLabel('s')).toBe('s label');
    expect(l.subjectOf('retired')).toBeUndefined();
  });
});
