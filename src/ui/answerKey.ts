import { clozeAnswers } from '../core/content/cloze.ts';
import { binOf } from '../core/content/estimation.ts';
import { chronological, parseTimelineDate } from '../core/content/timeline.ts';
import type { Question } from '../core/content/types.ts';
import { formatTimelineDate, withUnit } from './format.ts';
import { t } from './strings.ts';
import { thinker } from './thinkers.ts';

/** The right answer of any question as readable lines (Draft review, SPEC 16.4). */
export function answerKey(q: Question): string[] {
  switch (q.type) {
    case 'mcq':
      return [q.options[q.answer]?.text ?? ''];
    case 'recall':
      return [q.answer_text];
    case 'short':
      return [q.answers.join(' / ')];
    case 'cloze': {
      let i = 0;
      const answers = clozeAnswers(q.text);
      return [q.text.replace(/\{\{[^}]*\}\}/g, () => `[${answers[i++] ?? ''}]`)];
    }
    case 'match':
      return q.pairs.map((p) => `${p.left} → ${p.right}`);
    case 'order':
      return q.items.map((item, i) => `${i + 1}. ${item}`);
    case 'estimation': {
      const value = withUnit(q.value, q.unit);
      const bin = q.bins ? q.bins[binOf(q.bins, q.value)] : undefined;
      return bin?.label ? [`${bin.label} (${value})`] : [value];
    }
    case 'timeline':
      return chronological(q).map((i) => {
        const e = q.events[i];
        const d = e ? parseTimelineDate(e.date) : null;
        return `${d ? formatTimelineDate(d, q.precision) : (e?.date ?? '')}: ${e?.label ?? ''}`;
      });
    case 'image':
      return q.mode === 'mcq'
        ? [q.options[q.answer]?.text ?? '']
        : [t('review.spot', { label: q.hotspots[q.answer]?.label ?? '' })];
    case 'attribution':
      return [thinker(q.thinker).name];
  }
}

/** The other options a learner sees, where the type has them. */
export function distractors(q: Question): string[] {
  if (q.type === 'mcq' || (q.type === 'image' && q.mode === 'mcq')) {
    return q.options.filter((_, i) => i !== q.answer).map((o) => o.text);
  }
  if (q.type === 'attribution') return q.options.map((id) => thinker(id).name);
  if (q.type === 'cloze') return [...(q.bank ?? [])];
  if (q.type === 'image' && q.mode === 'hotspot') {
    return q.hotspots.filter((_, i) => i !== q.answer).map((h) => h.label);
  }
  return [];
}
