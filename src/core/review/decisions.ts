import type { Question } from '../content/types.ts';

/** Draft review (SPEC 16.4 path B). */
export type Decision = 'approve' | 'reject' | 'edit';
export const DECISIONS: readonly Decision[] = ['approve', 'edit', 'reject'];

export interface ReviewDecision {
  readonly questionId: string;
  readonly decision: Decision;
  readonly note?: string;
  /** UTC epoch ms when decided. */
  readonly ts: number;
}

export interface DecisionsExport {
  readonly format: 'pleiad-review-decisions';
  readonly exportedAt: string;
  readonly decisions: readonly ReviewDecision[];
}

export function isDecision(v: unknown): v is ReviewDecision {
  const d = v as Partial<ReviewDecision> | null;
  return (
    !!d &&
    typeof d.questionId === 'string' &&
    (DECISIONS as readonly unknown[]).includes(d.decision) &&
    typeof d.ts === 'number' &&
    (d.decision !== 'edit' || (typeof d.note === 'string' && d.note.trim().length > 0))
  );
}

export function decisionsExport(
  decisions: readonly ReviewDecision[],
  exportedAt: string,
): DecisionsExport {
  return {
    format: 'pleiad-review-decisions',
    exportedAt,
    decisions: [...decisions].sort((a, b) => (a.questionId < b.questionId ? -1 : 1)),
  };
}

/** Parse a decisions file; throws with a readable message when it is not one. */
export function parseDecisions(text: string): ReviewDecision[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not a JSON file.');
  }
  const d = data as Partial<DecisionsExport> | null;
  if (!d || d.format !== 'pleiad-review-decisions' || !Array.isArray(d.decisions)) {
    throw new Error('Not a Pleiad review-decisions file.');
  }
  const bad = d.decisions.filter((x) => !isDecision(x));
  if (bad.length > 0) throw new Error(`${bad.length} decision(s) are malformed.`);
  return d.decisions as ReviewDecision[];
}

/** The ISO date (YYYY-MM-DD, UTC) of a decision, used as verified_on. */
export const decisionDate = (ts: number): string => new Date(ts).toISOString().slice(0, 10);

export interface ApplyResult {
  /** Questions with their new status (only changed ones). */
  readonly changed: ReadonlyMap<string, Question>;
  readonly verified: readonly string[];
  readonly retired: readonly string[];
  readonly needsEdit: readonly { readonly id: string; readonly note: string }[];
  /** Decisions that were not applied, with the reason. */
  readonly skipped: readonly { readonly id: string; readonly reason: string }[];
}

/**
 * Apply review decisions to questions (pure). Only drafts change: approve
 * verifies (verified_on = decision date), reject retires, edit leaves the
 * draft and reports the note.
 */
export function applyDecisions(
  questions: ReadonlyMap<string, Question>,
  decisions: readonly ReviewDecision[],
): ApplyResult {
  const changed = new Map<string, Question>();
  const verified: string[] = [];
  const retired: string[] = [];
  const needsEdit: { id: string; note: string }[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const d of decisions) {
    const q = questions.get(d.questionId);
    if (!q) {
      skipped.push({ id: d.questionId, reason: 'unknown ID' });
      continue;
    }
    if (q.status !== 'draft') {
      skipped.push({ id: d.questionId, reason: `already ${q.status}` });
      continue;
    }
    if (d.decision === 'approve') {
      const date = decisionDate(d.ts);
      // verified_on may not precede created (validator rule).
      changed.set(q.id, {
        ...q,
        status: 'verified',
        verified_on: date < q.created ? q.created : date,
      });
      verified.push(q.id);
    } else if (d.decision === 'reject') {
      changed.set(q.id, { ...q, status: 'retired' });
      retired.push(q.id);
    } else {
      needsEdit.push({ id: q.id, note: d.note ?? '' });
    }
  }
  return { changed, verified, retired, needsEdit, skipped };
}
