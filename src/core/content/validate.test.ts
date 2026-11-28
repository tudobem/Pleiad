import { describe, expect, it } from 'vitest';
import { validateContent, type ValidateInput } from './validate.ts';
import {
  NODES,
  cloze,
  estimation,
  ledgerFor,
  match,
  mcq,
  meta,
  order,
  pack,
  recall,
  short,
  timeline,
  imageMcq,
  hotspot,
  attribution,
  THINKERS,
} from './fixtures.test-util.ts';
import type { EstimationQuestion, LoadedPack } from './types.ts';

const TOKENS = new Set(['gold', 'link']);

function codes(input: Partial<ValidateInput> & { packs: LoadedPack[] }): string[] {
  const full: ValidateInput = { accentTokens: TOKENS, ledger: ledgerFor(...input.packs), ...input };
  return validateContent(full).issues.map((i) => `${i.level}:${i.code}`);
}

describe('validateContent', () => {
  it('accepts a valid pack with no issues', () => {
    expect(codes({ packs: [pack([mcq(), recall()])] })).toEqual([]);
  });

  describe('pack metadata', () => {
    it('requires id to match the folder', () => {
      const p = { ...pack([mcq()]), meta: meta({ id: 'other' }) };
      expect(codes({ packs: [p], ledger: { 'q-mcq-0001': 'other' } })).toContain(
        'error:pack.id-mismatch',
      );
    });

    it('requires domainPath to be an existing root-down path', () => {
      const missing = { ...pack([]), meta: meta({ domainPath: ['science', 'nope'] }) };
      expect(codes({ packs: [missing] })).toContain('error:pack.domain-path');
      const skipped = { ...pack([]), meta: meta({ domainPath: ['cons'] }) };
      expect(codes({ packs: [skipped] })).toContain('error:pack.domain-path');
    });

    it('requires the accent to be a known token', () => {
      const p = { ...pack([]), meta: meta({ accent: 'purple' }) };
      expect(codes({ packs: [p] })).toContain('error:pack.accent');
    });
  });

  describe('questions', () => {
    it('rejects duplicate IDs across packs', () => {
      const a = pack([mcq()]);
      const b = pack([mcq({ pack: 'b-pack' })], {
        folder: 'b-pack',
        meta: meta({ id: 'b-pack' }),
      });
      expect(codes({ packs: [a, b], ledger: ledgerFor(a) })).toContain(
        'error:question.duplicate-id',
      );
    });

    it('checks pack and topic consistency', () => {
      expect(codes({ packs: [pack([mcq({ pack: 'elsewhere' })])] })).toContain(
        'error:question.pack',
      );
      const wrongFile = pack([mcq()]);
      const moved: LoadedPack = {
        ...wrongFile,
        questionFiles: [
          { path: 'cons-pack/questions/gwt.json', topicFromName: 'gwt', questions: [mcq()] },
        ],
      };
      expect(codes({ packs: [moved] })).toContain('error:question.topic-file');
    });

    it('rejects unknown topics and non-topic nodes', () => {
      expect(codes({ packs: [pack([mcq({ topic: 'ghost' })])] })).toContain('error:question.topic');
      expect(codes({ packs: [pack([mcq({ topic: 'theories' })])] })).toContain(
        'error:question.topic',
      );
    });

    it('ties verified_on to status verified', () => {
      expect(codes({ packs: [pack([mcq({ status: 'verified' })])] })).toContain(
        'error:question.verified-on',
      );
      expect(codes({ packs: [pack([mcq({ verified_on: '2026-02-01' })])] })).toContain(
        'error:question.verified-on',
      );
      expect(
        codes({ packs: [pack([mcq({ status: 'verified', verified_on: '2025-12-31' })])] }),
      ).toContain('error:question.verified-on');
      expect(
        codes({ packs: [pack([mcq({ status: 'verified', verified_on: '2026-02-01' })])] }),
      ).toEqual([]);
    });

    it('requires media files to exist', () => {
      const q = mcq({ media: [{ src: 'media/a.png', alt: 'A diagram', license: 'CC-BY-4.0' }] });
      expect(codes({ packs: [pack([q])] })).toContain('error:media.missing');
      expect(codes({ packs: [pack([q], { mediaFiles: ['media/a.png'] })] })).toEqual([]);
    });
  });

  describe('mcq rules', () => {
    const opts = (texts: string[]) => texts.map((text) => ({ text }));

    it('rejects an out-of-range answer', () => {
      expect(codes({ packs: [pack([mcq({ answer: 4 })])] })).toContain('error:mcq.answer-range');
    });

    it.each(['All of the above', 'None of these', 'none of the above.', 'Both of the above'])(
      'rejects catch-all option "%s"',
      (text) => {
        const q = mcq({ options: opts(['A real answer', 'Another', 'Third', text]) });
        expect(codes({ packs: [pack([q])] })).toContain('error:mcq.catch-all');
      },
    );

    it('rejects options that are the same after normalization', () => {
      const q = mcq({
        options: opts(['Global broadcast', 'global  broadcast!', 'Third', 'Fourth']),
      });
      expect(codes({ packs: [pack([q])] })).toContain('error:mcq.duplicate-option');
    });

    it('rejects why_wrong on the correct option', () => {
      const q = mcq({
        options: [{ text: 'Right', why_wrong: 'oops' }, ...opts(['B', 'C', 'D'])],
      });
      expect(codes({ packs: [pack([q])] })).toContain('error:mcq.why-wrong-on-answer');
    });
  });

  describe('new question types', () => {
    it('accepts valid short, cloze, match and order items', () => {
      expect(codes({ packs: [pack([short(), cloze(), match(), order()])] })).toEqual([]);
    });

    it('checks short answers', () => {
      expect(codes({ packs: [pack([short({ answers: ['Tononi', 'tononi!'] })])] })).toContain(
        'error:short.duplicate',
      );
      expect(codes({ packs: [pack([short({ answers: ['?!'] })])] })).toContain('error:short.empty');
      const numeric = short({ answers: ['86 billion'], numeric: { value: 86e9, tolerance: 1e9 } });
      expect(codes({ packs: [pack([numeric])] })).toContain('error:short.numeric');
      const ok = short({ answers: ['86000000000'], numeric: { value: 86e9, tolerance: 1e9 } });
      expect(codes({ packs: [pack([ok])] })).toEqual([]);
    });

    it('checks cloze blanks and distractors', () => {
      expect(codes({ packs: [pack([cloze({ text: 'No blanks here.' })])] })).toContain(
        'error:cloze.no-blank',
      );
      expect(codes({ packs: [pack([cloze({ text: 'An {{ }} blank.' })])] })).toContain(
        'error:cloze.empty-blank',
      );
      expect(codes({ packs: [pack([cloze({ bank: ['tononi'] })])] })).toContain('error:cloze.bank');
      expect(codes({ packs: [pack([cloze({ bank: ['Baars', 'baars'] })])] })).toContain(
        'error:cloze.bank',
      );
    });

    it('checks match and order items are distinct', () => {
      const dupLeft = match({
        pairs: [
          { left: 'IIT', right: 'Tononi' },
          { left: 'iit', right: 'Baars' },
          { left: 'HOT', right: 'Rosenthal' },
        ],
      });
      expect(codes({ packs: [pack([dupLeft])] })).toContain('error:match.duplicate');
      expect(codes({ packs: [pack([order({ items: ['A', 'B', 'a'] })])] })).toContain(
        'error:order.duplicate',
      );
    });
  });

  describe('estimation and timeline', () => {
    /** An estimation item with bins instead of a slider. */
    const withBins = (
      bins: { min: number; max: number }[],
      o: Partial<EstimationQuestion> = {},
    ): EstimationQuestion =>
      ({
        ...Object.fromEntries(
          Object.entries(estimation(o)).filter(([k]) => k !== 'range' && k !== 'tolerance'),
        ),
        bins,
      }) as unknown as EstimationQuestion;

    it('accepts valid items', () => {
      const bins = withBins(
        [
          { min: 1e6, max: 1e9 },
          { min: 1e9, max: 1e11 },
          { min: 1e11, max: 1e13 },
        ],
        { id: 'q-est-0002', prompt: 'Roughly how many synapses does a cortical neuron have?' },
      );
      expect(codes({ packs: [pack([estimation(), bins, timeline()])] })).toEqual([]);
    });

    it('checks estimation numbers', () => {
      const has = (o: Parameters<typeof estimation>[0], code: string) =>
        expect(codes({ packs: [pack([estimation(o)])] })).toContain(code);
      has({ value: 1e14 }, 'error:estimation.value');
      has({ range: { min: 0, max: 10 }, value: 5 }, 'error:estimation.log');
      has({ tolerance: 0.5 }, 'error:estimation.tolerance');
      has({ range: { min: 10, max: 1 }, value: 5 }, 'error:estimation.range');
      const bins = (b: { min: number; max: number }[]) => codes({ packs: [pack([withBins(b)])] });
      expect(
        bins([
          { min: 1, max: 10 },
          { min: 5, max: 1e12 },
          { min: 1e12, max: 1e13 },
        ]),
      ).toContain('error:estimation.bins');
      expect(
        bins([
          { min: 1, max: 10 },
          { min: 10, max: 100 },
          { min: 100, max: 1000 },
        ]),
      ).toContain('error:estimation.value');
    });

    it('checks timeline dates', () => {
      const with_ = (dates: string[], precision?: 'year' | 'month') =>
        codes({
          packs: [
            pack([
              timeline({
                events: dates.map((date, i) => ({ label: `e${i}`, date })),
                ...(precision ? { precision } : {}),
              }),
            ]),
          ],
        });
      expect(with_(['1974', '1974', '1995'])).toContain('error:timeline.tie');
      expect(with_(['1974', '1995-03', '1996'])).toContain('error:timeline.precision');
      expect(with_(['1974', 'later', '1996'])).toContain('error:timeline.date');
      expect(with_(['1974-01', '1974-02', '1995-03'], 'month')).toEqual([]);
      expect(with_(['-0350', '1641', '1995'])).toEqual([]);
    });
  });

  describe('image and attribution', () => {
    const media = { mediaFiles: ['media/cube.svg', 'media/gw.svg'] };
    const withThinkers = { ...media, thinkers: THINKERS };

    it('accepts valid items', () => {
      expect(
        codes({ packs: [pack([imageMcq(), hotspot(), attribution()], withThinkers)] }),
      ).toEqual([]);
    });

    it('checks images and hotspots', () => {
      const has = (q: ReturnType<typeof hotspot>, code: string, extra = {}) =>
        expect(codes({ packs: [pack([q], { ...media, ...extra })] })).toContain(code);
      has(hotspot({ answer: 3 }), 'error:image.answer');
      has(
        hotspot({
          hotspots: [
            { x: 50, y: 50, r: 12, label: 'A' },
            { x: 55, y: 50, r: 10, label: 'B' },
          ],
        }),
        'error:image.overlap',
      );
      has(
        hotspot({
          hotspots: [
            { x: 120, y: 50, r: 5, label: 'A' },
            { x: 10, y: 10, r: 5, label: 'B' },
          ],
        }),
        'error:image.hotspot',
      );
      has(imageMcq({ answer: 7 }), 'error:mcq.answer-range');
      has(imageMcq(), 'error:media.too-large', { mediaBytes: { 'media/cube.svg': 200_000 } });
      const gif = imageMcq({
        media: [{ src: 'media/x.gif', alt: 'x', license: 'CC-BY-4.0' }],
      } as never);
      expect(codes({ packs: [pack([gif], { mediaFiles: ['media/x.gif'] })] })).toContain(
        'error:media.type',
      );
    });

    it('checks thinkers', () => {
      const one = (q: ReturnType<typeof attribution>, thinkers = THINKERS) =>
        codes({ packs: [pack([q], { thinkers })] });
      expect(one(attribution({ options: ['tononi', 'koch', 'nobody'] }))).toContain(
        'error:attribution.unknown',
      );
      expect(one(attribution({ options: ['tononi', 'koch', 'baars'] }))).toContain(
        'error:attribution.duplicate',
      );
      const twice = [...THINKERS, { id: 'koch', name: 'C. Koch' }];
      expect(one(attribution(), twice)).toContain('error:thinker.duplicate');
      const a = pack([attribution()], { thinkers: THINKERS });
      const b = pack([], {
        folder: 'other-pack',
        thinkers: [{ id: 'koch', name: 'Someone else' }],
      });
      expect(codes({ packs: [a, b] })).toContain('error:thinker.conflict');
    });
  });

  describe('references', () => {
    it('checks confusable_with', () => {
      expect(codes({ packs: [pack([mcq({ confusable_with: ['ghost'] })])] })).toContain(
        'error:ref.confusable',
      );
      expect(codes({ packs: [pack([mcq({ confusable_with: ['q-mcq-0001'] })])] })).toContain(
        'error:ref.confusable',
      );
      const ok = pack([mcq({ confusable_with: ['q-recall-0001'] }), recall()]);
      expect(codes({ packs: [ok] })).toEqual([]);
    });

    it('warns when confusable_with points at a retired item', () => {
      const p = pack([mcq({ confusable_with: ['q-recall-0001'] }), recall({ status: 'retired' })]);
      expect(codes({ packs: [p] })).toContain('warning:ref.retired');
    });

    it('checks prerequisites against questions and concepts', () => {
      expect(codes({ packs: [pack([mcq({ prerequisites: ['ghost'] })])] })).toContain(
        'error:ref.prerequisite',
      );
      const concepts = { nodes: [{ id: 'phi', label: 'Phi' }], edges: [] };
      const ok = pack([mcq({ prerequisites: ['phi', 'q-recall-0001'] }), recall()], { concepts });
      expect(codes({ packs: [ok] })).toEqual([]);
    });

    it('checks concepts and concept edges, and warns on orphans', () => {
      expect(codes({ packs: [pack([mcq({ concepts: ['phi'] })])] })).toContain('error:ref.concept');
      const concepts = {
        nodes: [
          { id: 'phi', label: 'Phi', topic: 'iit' },
          { id: 'unused', label: 'Unused' },
        ],
        edges: [{ from: 'phi', to: 'ghost', relation: 'related' as const }],
      };
      const result = codes({ packs: [pack([mcq({ concepts: ['phi'] })], { concepts })] });
      expect(result).toContain('error:concept.edge');
      expect(result).toContain('warning:concept.orphan');
      const badTopic = { nodes: [{ id: 'phi', label: 'Phi', topic: 'theories' }], edges: [] };
      expect(
        codes({ packs: [pack([mcq({ concepts: ['phi'] })], { concepts: badTopic })] }),
      ).toContain('error:concept.topic');
    });
  });

  it('warns about near-duplicate prompts but not retired ones', () => {
    const a = mcq();
    const b = mcq({
      id: 'q-mcq-0002',
      prompt: 'What does phi measure, in integrated information theory?',
    });
    expect(codes({ packs: [pack([a, b])] })).toContain('warning:question.near-duplicate');
    const retired = { ...b, status: 'retired' as const };
    expect(codes({ packs: [pack([a, retired])] })).toEqual([]);
  });

  describe('id ledger', () => {
    it('flags deleted, moved and unregistered IDs', () => {
      const p = pack([mcq()]);
      expect(codes({ packs: [p], ledger: { ...ledgerFor(p), 'old-0001': 'cons-pack' } })).toContain(
        'error:ledger.deleted',
      );
      expect(codes({ packs: [p], ledger: { 'q-mcq-0001': 'other-pack' } })).toContain(
        'error:ledger.moved',
      );
      expect(codes({ packs: [p], ledger: {} })).toContain('error:ledger.unregistered');
    });

    it('keeps retired items valid', () => {
      const p = pack([mcq({ status: 'retired' })]);
      expect(codes({ packs: [p] })).toEqual([]);
    });
  });

  it('merges shared taxonomy nodes across packs', () => {
    const a = pack([mcq()]);
    const b = pack([recall({ pack: 'b-pack' })], {
      folder: 'b-pack',
      meta: meta({ id: 'b-pack' }),
    });
    expect(codes({ packs: [a, b] })).toEqual([]);
    expect(NODES.length).toBe(5);
  });
});
