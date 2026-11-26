import type { ContentIndex, IndexTreeNode } from '../content/contentIndex.ts';
import type { NodeKind } from '../content/types.ts';
import { nextDayStartMs } from '../scheduler/day.ts';
import { introduced } from '../session/dailyQueue.ts';
import type { CardState } from '../sync/replay.ts';

/** Progress counted over verified questions only (SPEC 14.1 coverage). */
export interface Progress {
  /** Verified questions. Drafts and retired items never count. */
  readonly verified: number;
  /** Verified questions introduced into the schedule. */
  readonly started: number;
  /** Verified questions due before the learning day ends. */
  readonly due: number;
}

/** A branch or topic row on the subject page. */
export interface LibraryNode extends Progress {
  readonly id: string;
  readonly label: string;
  readonly kind: NodeKind;
  readonly children: readonly LibraryNode[];
}

export interface LibrarySubject extends LibraryNode {
  readonly domainId: string;
  readonly domainLabel: string;
  /** Packs that serve this subject. */
  readonly packs: readonly string[];
  /** Accent color token of the subject's first pack. */
  readonly accent: string;
  /** All of the subject's packs are active (in the Daily queue). */
  readonly active: boolean;
  readonly lastReviewTs: number | null;
  readonly questionIds: readonly string[];
}

export interface LibraryDomain {
  readonly id: string;
  readonly label: string;
  readonly subjects: readonly LibrarySubject[];
}

export interface Library {
  readonly domains: readonly LibraryDomain[];
  readonly subjects: readonly LibrarySubject[];
}

export interface LibraryInput {
  readonly index: ContentIndex;
  readonly cards: ReadonlyMap<string, CardState>;
  readonly activePacks: readonly string[];
  readonly now: number;
  readonly offsetMinutes: number;
}

const DEFAULT_ACCENT = 'gold';

/** IDs of the verified questions under a node, in tree order. */
export function questionIdsUnder(node: IndexTreeNode): string[] {
  return [...(node.questionIds ?? []), ...node.children.flatMap(questionIdsUnder)];
}

/**
 * The Library (SPEC 12, DESIGN 4.4): domains with their subjects and each
 * subject's branch and topic rows, built from the content index and the
 * replayed cards only, so no pack has to be loaded.
 */
export function buildLibrary(input: LibraryInput): Library {
  const { index, cards, now, offsetMinutes } = input;
  const end = nextDayStartMs(now, offsetMinutes);
  const active = new Set(input.activePacks);

  const progress = (ids: readonly string[]): Progress => {
    let started = 0;
    let due = 0;
    for (const id of ids) {
      if (introduced(cards, id)) started += 1;
      const s = cards.get(id)?.scheduler;
      if (s && s.due < end) due += 1;
    }
    return { verified: ids.length, started, due };
  };

  const row = (node: IndexTreeNode): LibraryNode => ({
    id: node.id,
    label: node.label,
    kind: node.kind,
    ...progress(questionIdsUnder(node)),
    children: node.children.map(row),
  });

  const domains: LibraryDomain[] = [];
  for (const domain of index.tree) {
    const subjects: LibrarySubject[] = [];
    for (const node of domain.children) {
      if (node.kind !== 'subject') continue;
      const ids = questionIdsUnder(node);
      const byPath = index.packs.filter((p) => p.domainPath.includes(node.id));
      const packs =
        byPath.length > 0 ? byPath : index.packs.filter((p) => node.packs.includes(p.id));
      let lastReviewTs: number | null = null;
      for (const id of ids) {
        const ts = cards.get(id)?.lastReviewTs;
        if (ts !== undefined && (lastReviewTs === null || ts > lastReviewTs)) lastReviewTs = ts;
      }
      subjects.push({
        ...row(node),
        domainId: domain.id,
        domainLabel: domain.label,
        packs: packs.map((p) => p.id),
        accent: packs[0]?.accent ?? DEFAULT_ACCENT,
        active: packs.length > 0 && packs.every((p) => active.has(p.id)),
        lastReviewTs,
        questionIds: ids,
      });
    }
    if (subjects.length > 0) domains.push({ id: domain.id, label: domain.label, subjects });
  }
  return { domains, subjects: domains.flatMap((d) => d.subjects) };
}

/** The Continue shelf: started subjects, most recently reviewed first. */
export function continueShelf(library: Library): LibrarySubject[] {
  return library.subjects
    .filter((s) => s.started > 0)
    .sort((a, b) => (b.lastReviewTs ?? 0) - (a.lastReviewTs ?? 0));
}

export const LIBRARY_FILTERS = ['all', 'started', 'new', 'due'] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

export function matchesFilter(subject: Progress, filter: LibraryFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'started':
      return subject.started > 0;
    case 'new':
      return subject.started === 0 && subject.verified > 0;
    case 'due':
      return subject.due > 0;
  }
}

export function findSubject(library: Library, id: string): LibrarySubject | undefined {
  return library.subjects.find((s) => s.id === id);
}

/** Whole-percent share of started items (0 when there is nothing to start). */
export function coveragePercent(p: Progress): number {
  return p.verified === 0 ? 0 : Math.round((100 * p.started) / p.verified);
}
