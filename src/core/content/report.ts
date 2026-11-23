import { compareStrings } from './normalize.ts';
import { QUESTION_TYPES, STATUSES, TIERS } from './types.ts';
import type { LoadedPack, Question, QuestionStatus, QuestionType, Tier } from './types.ts';

export interface Counts {
  total: number;
  byStatus: Record<QuestionStatus, number>;
  byTier: Record<Tier, number>;
  byType: Record<QuestionType, number>;
}

export function emptyCounts(): Counts {
  return {
    total: 0,
    byStatus: Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<QuestionStatus, number>,
    byTier: Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>,
    byType: Object.fromEntries(QUESTION_TYPES.map((t) => [t, 0])) as Record<QuestionType, number>,
  };
}

export function addToCounts(counts: Counts, q: Question): void {
  counts.total += 1;
  counts.byStatus[q.status] += 1;
  counts.byTier[q.tier] += 1;
  counts.byType[q.type] += 1;
}

export interface ContentReport {
  readonly overall: Counts;
  readonly byPack: ReadonlyMap<string, Counts>;
  readonly byTopic: ReadonlyMap<string, Counts>;
}

export function countContent(packs: readonly LoadedPack[]): ContentReport {
  const overall = emptyCounts();
  const byPack = new Map<string, Counts>();
  const byTopic = new Map<string, Counts>();
  for (const pack of packs) {
    const packCounts = emptyCounts();
    byPack.set(pack.meta.id, packCounts);
    for (const qf of pack.questionFiles) {
      for (const q of qf.questions) {
        addToCounts(overall, q);
        addToCounts(packCounts, q);
        let topicCounts = byTopic.get(q.topic);
        if (!topicCounts) {
          topicCounts = emptyCounts();
          byTopic.set(q.topic, topicCounts);
        }
        addToCounts(topicCounts, q);
      }
    }
  }
  return { overall, byPack, byTopic };
}

/** Plain-text report for the CLI (SPEC 5.6). */
export function formatReport(report: ContentReport): string {
  const line = (label: string, c: Counts): string =>
    `  ${label.padEnd(34)} ${String(c.total).padStart(4)}  ` +
    `status ${fmt(c.byStatus)}  tier ${fmt(c.byTier)}  type ${fmt(c.byType)}`;
  const sections = [
    'Totals',
    line('all packs', report.overall),
    'By pack',
    ...[...report.byPack].sort(([a], [b]) => compareStrings(a, b)).map(([id, c]) => line(id, c)),
    'By topic',
    ...[...report.byTopic].sort(([a], [b]) => compareStrings(a, b)).map(([id, c]) => line(id, c)),
  ];
  return sections.join('\n');
}

function fmt(record: Record<string, number>): string {
  return Object.entries(record)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
}
