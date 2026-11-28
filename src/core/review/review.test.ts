import { describe, expect, it } from 'vitest';
import { mcq, recall } from '../content/fixtures.test-util.ts';
import type { Question } from '../content/types.ts';
import {
  applyDecisions,
  decisionsExport,
  isDecision,
  parseDecisions,
  type ReviewDecision,
} from './decisions.ts';
import { flagsExport, makeFlag, makeNote, NOTE_MAX } from './flags.ts';

const TS = Date.UTC(2026, 10, 28, 9);

describe('flags and notes', () => {
  it('trims notes and drops empty ones', () => {
    expect(makeFlag('q1', 'wrong', '  typo in B  ', TS, '1.0')).toEqual({
      questionId: 'q1',
      kind: 'wrong',
      note: 'typo in B',
      ts: TS,
      appVersion: '1.0',
    });
    expect(makeFlag('q1', 'unclear', '   ', TS, '1.0').note).toBeUndefined();
    expect(makeNote('   ', TS)).toBeNull();
    expect(makeNote('x'.repeat(NOTE_MAX + 10), TS)?.text).toHaveLength(NOTE_MAX);
  });

  it('exports well-formed flags oldest first', () => {
    const out = flagsExport(
      [
        makeFlag('b', 'wrong', '', TS + 1, 'v'),
        { junk: true },
        makeFlag('a', 'unclear', '', TS, 'v'),
      ],
      '2026-11-28T09:00:00.000Z',
    );
    expect(out.format).toBe('pleiad-flags');
    expect(out.flags.map((f) => f.questionId)).toEqual(['a', 'b']);
  });
});

describe('review decisions', () => {
  const draft = (id: string): Question =>
    mcq({ id, status: 'draft', created: '2026-11-27' } as never);
  const questions = new Map<string, Question>([
    ['d1', draft('d1')],
    ['d2', draft('d2')],
    ['d3', recall({ id: 'd3', status: 'draft' } as never)],
    ['v1', mcq({ id: 'v1', status: 'verified', verified_on: '2026-01-02' })],
  ]);
  const d = (questionId: string, decision: ReviewDecision['decision'], note?: string) => ({
    questionId,
    decision,
    ts: TS,
    ...(note ? { note } : {}),
  });

  it('verifies, retires and lists edits, touching drafts only', () => {
    const r = applyDecisions(questions, [
      d('d1', 'approve'),
      d('d2', 'reject'),
      d('d3', 'edit', 'Option C is ambiguous'),
      d('v1', 'reject'),
      d('nope', 'approve'),
    ]);
    expect(r.verified).toEqual(['d1']);
    expect(r.changed.get('d1')).toMatchObject({ status: 'verified', verified_on: '2026-11-28' });
    expect(r.retired).toEqual(['d2']);
    expect(r.changed.get('d2')?.status).toBe('retired');
    expect(r.needsEdit).toEqual([{ id: 'd3', note: 'Option C is ambiguous' }]);
    expect(r.skipped).toEqual([
      { id: 'v1', reason: 'already verified' },
      { id: 'nope', reason: 'unknown ID' },
    ]);
    expect(r.changed.has('d3')).toBe(false);
  });

  it('round-trips the export and rejects bad files', () => {
    const file = JSON.stringify(decisionsExport([d('d2', 'reject'), d('d1', 'approve')], 'x'));
    expect(parseDecisions(file).map((x) => x.questionId)).toEqual(['d1', 'd2']);
    expect(() => parseDecisions('{')).toThrow('Not a JSON file.');
    expect(() => parseDecisions('{"format":"other"}')).toThrow('Not a Pleiad');
    expect(isDecision(d('d3', 'edit'))).toBe(false); // an edit needs a note
  });
});
