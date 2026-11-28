import { describe, expect, it } from 'vitest';
import {
  attribution,
  cloze,
  estimation,
  hotspot,
  mcq,
  timeline,
} from '../core/content/fixtures.test-util.ts';
import { answerKey, distractors } from './answerKey.ts';
import { registerThinkers } from './thinkers.ts';

describe('answerKey', () => {
  it('shows the right answer for each type', () => {
    const q = mcq();
    expect(answerKey(q)).toEqual([q.options[q.answer]?.text]);
    expect(distractors(q)).toHaveLength(q.options.length - 1);
    expect(answerKey(cloze({ text: 'IIT was proposed by {{Tononi}} in {{2004}}.' }))).toEqual([
      'IIT was proposed by [Tononi] in [2004].',
    ]);
    expect(answerKey(estimation())).toEqual(['86 billion neurons']);
    expect(answerKey(timeline())).toEqual([
      '1974: Nagel: what is it like to be a bat?',
      '1982: Jackson: what Mary did not know',
      '1995: Chalmers: the hard problem',
    ]);
    expect(answerKey(hotspot())).toEqual(['Spot: Workspace']);
  });

  it('names thinkers once their pack is loaded', () => {
    expect(answerKey(attribution())).toEqual(['baars']);
    registerThinkers([{ id: 'baars', name: 'Bernard Baars' }]);
    expect(answerKey(attribution())).toEqual(['Bernard Baars']);
  });
});
