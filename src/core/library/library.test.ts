import { describe, expect, it } from 'vitest';
import type { ContentIndex, IndexPack, IndexTreeNode } from '../content/contentIndex.ts';
import { emptyCounts } from '../content/report.ts';
import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { DAY_MS } from '../scheduler/day.ts';
import { replayCards } from '../sync/replay.ts';
import { reviewEvent } from '../storageContract.test-util.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import {
  buildLibrary,
  continueShelf,
  coveragePercent,
  findSubject,
  matchesFilter,
} from './library.ts';
import { searchLibrary } from './search.ts';

const node = (
  id: string,
  kind: IndexTreeNode['kind'],
  children: IndexTreeNode[] = [],
  extra: Partial<IndexTreeNode> = {},
): IndexTreeNode => ({
  id,
  label: extra.label ?? id,
  kind,
  packs: [],
  counts: emptyCounts(),
  children,
  ...extra,
});
const topic = (id: string, ids: string[], label = id, tags: string[] = []) =>
  node(id, 'topic', [], { label, questionIds: ids, tags });

const indexPack = (id: string, domainPath: string[], accent: string): IndexPack => ({
  id,
  title: id,
  description: '',
  version: '0.1.0',
  language: 'en',
  license: 'CC-BY-4.0',
  accent,
  domainPath,
  bytes: 1,
  file: `packs/${id}.x.json`,
  topics: [],
  counts: emptyCounts(),
});

const INDEX: ContentIndex = {
  version: 3,
  packs: [
    indexPack('mind', ['philosophy', 'pom'], 'link'),
    indexPack('sci', ['science', 'cs'], 'gold'),
  ],
  tree: [
    node(
      'philosophy',
      'domain',
      [
        node(
          'pom',
          'subject',
          [
            node(
              'method',
              'branch',
              [topic('phenomenology', ['m1', 'm2'], 'Phenomenology', ['Husserl', 'epoché'])],
              { label: 'Method' },
            ),
            node('empty-branch', 'branch', [topic('later', [])], { label: 'Coming later' }),
          ],
          { label: 'Philosophy of mind' },
        ),
      ],
      { label: 'Philosophy' },
    ),
    node(
      'science',
      'domain',
      [
        node(
          'cs',
          'subject',
          [
            node('hist', 'branch', [topic('early', ['s1', 's2', 's3'], 'Early history')], {
              label: 'History',
            }),
          ],
          {
            label: 'Consciousness science',
          },
        ),
      ],
      { label: 'Science' },
    ),
  ],
};

const scheduler = fsrsScheduler();
const NOW = Date.UTC(2026, 10, 24, 12);
let seq = 0;
const ev = (cardId: string, ts: number, overrides: Partial<ReviewEvent> = {}) =>
  reviewEvent({
    eventId: `e${(seq += 1)}`,
    cardId,
    ts,
    mode: 'scheduled',
    rating: 'good',
    ...overrides,
  });

function library(events: ReviewEvent[], activePacks = ['mind', 'sci']) {
  return buildLibrary({
    index: INDEX,
    cards: replayCards(events, scheduler),
    activePacks,
    now: NOW,
    offsetMinutes: 60,
  });
}

describe('buildLibrary', () => {
  it('groups subjects by domain with verified counts only', () => {
    const lib = library([]);
    expect(lib.domains.map((d) => d.id)).toEqual(['philosophy', 'science']);
    const pom = findSubject(lib, 'pom');
    expect(pom?.verified).toBe(2);
    expect(pom?.accent).toBe('link');
    expect(pom?.packs).toEqual(['mind']);
    expect(pom?.children.map((b) => [b.id, b.verified])).toEqual([
      ['method', 2],
      ['empty-branch', 0],
    ]);
    expect(pom?.questionIds).toEqual(['m1', 'm2']);
  });

  it('counts started and due items and the last review', () => {
    const events = [
      ev('s1', NOW - 30 * DAY_MS),
      ev('s2', NOW - 3_600_000),
      // Extra practice does not start a card.
      ev('s3', NOW - 1000, { mode: 'extra' }),
      // Not a verified question (retired or draft): never counted.
      ev('retired-1', NOW - 30 * DAY_MS),
    ];
    const cs = findSubject(library(events), 'cs');
    expect(cs?.started).toBe(2);
    expect(cs?.due).toBe(1);
    expect(cs?.lastReviewTs).toBe(NOW - 1000);
    expect(coveragePercent(cs ?? { verified: 0, started: 0, due: 0 })).toBe(67);
  });

  it('marks activation per subject', () => {
    const lib = library([], ['sci']);
    expect(findSubject(lib, 'pom')?.active).toBe(false);
    expect(findSubject(lib, 'cs')?.active).toBe(true);
  });

  it('orders the Continue shelf by the latest review and filters subjects', () => {
    const events = [ev('m1', NOW - 40 * DAY_MS), ev('s1', NOW - 30 * DAY_MS)];
    const lib = library(events);
    expect(continueShelf(lib).map((s) => s.id)).toEqual(['cs', 'pom']);
    expect(continueShelf(library([]))).toEqual([]);
    const fresh = library([]);
    expect(fresh.subjects.filter((s) => matchesFilter(s, 'new')).map((s) => s.id)).toEqual([
      'pom',
      'cs',
    ]);
    expect(fresh.subjects.filter((s) => matchesFilter(s, 'started'))).toEqual([]);
    expect(lib.subjects.filter((s) => matchesFilter(s, 'due')).map((s) => s.id)).toEqual([
      'pom',
      'cs',
    ]);
  });
});

describe('searchLibrary', () => {
  it('matches labels by word prefix, ignoring case and accents', () => {
    const results = searchLibrary(INDEX, 'PHENOM');
    expect(results.map((r) => r.id)).toEqual(['phenomenology']);
    expect(results[0]).toMatchObject({
      subjectId: 'pom',
      branchId: 'method',
      path: ['Philosophy of mind', 'Method'],
    });
    expect(searchLibrary(INDEX, 'history').map((r) => r.id)).toEqual(['hist', 'early']);
    expect(searchLibrary(INDEX, 'istory')).toEqual([]);
  });

  it('finds topics by tag, with or without accents', () => {
    expect(searchLibrary(INDEX, 'epoche')[0]).toMatchObject({ id: 'phenomenology', tag: 'epoché' });
    expect(searchLibrary(INDEX, 'husserl')[0]?.tag).toBe('Husserl');
  });

  it('ranks shallower label matches first and ignores empty queries', () => {
    expect(searchLibrary(INDEX, 'consciousness').map((r) => r.kind)).toEqual(['subject']);
    expect(searchLibrary(INDEX, 'philosophy mind').map((r) => r.id)).toEqual(['pom']);
    expect(searchLibrary(INDEX, '  ')).toEqual([]);
  });
});
