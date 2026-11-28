import { describe, expect, it } from 'vitest';
import { ankiRows, buildImportPack, csvRows, parseAnki, parseCsv, stripHtml } from './import.ts';

describe('CSV', () => {
  it('handles quotes, commas, doubled quotes and newlines', () => {
    const text = 'type,prompt,answer\nrecall,"A, B","He said ""hi""\nthen left"\r\nshort,Q2,x\n';
    expect(parseCsv(text)).toEqual([
      ['type', 'prompt', 'answer'],
      ['recall', 'A, B', 'He said "hi"\nthen left'],
      ['short', 'Q2', 'x'],
    ]);
  });

  it('turns rows into import rows and reports bad ones by line', () => {
    const table = parseCsv(
      [
        'type,topic,tier,prompt,answer,options,explanation,source,tags',
        'mcq,Basics,foundational,Q1?,Right,W1|W2|W3,Because.,Book p. 3,iit|Contrast',
        'mcq,Basics,,Q2?,Right,W1,,,',
        'essay,Basics,,Q3?,x,,,,',
        'short,Other,advanced,Q4?,86 billion|86000000000,,,',
      ].join('\n'),
    );
    const { rows, errors } = csvRows(table, 'My notes');
    expect(errors).toEqual([
      'Line 3: MCQ needs 3 or 4 distractors in options.',
      'Line 4: type "essay" (use mcq, recall or short).',
    ]);
    expect(rows.map((r) => [r.line, r.type, r.topic, r.tier, r.source])).toEqual([
      [2, 'mcq', 'Basics', 'foundational', 'Book p. 3'],
      [5, 'short', 'Other', 'advanced', 'My notes'],
    ]);
    expect(rows[0]?.tags).toEqual(['iit', 'contrast']);
    expect(csvRows([['prompt']], 'x').errors[0]).toContain('type, answer');
  });
});

describe('Anki', () => {
  it('reads tab-separated notes and strips HTML', () => {
    const notes = parseAnki(
      '#separator:tab\n#html:true\nWhat is <b>IIT</b>?\tTononi&#39;s theory<br>2004\n\nlonely\t\n',
    );
    expect(notes[0]).toEqual({ front: 'What is IIT?', back: "Tononi's theory 2004", line: 3 });
    const { rows, errors } = ankiRows(notes, 'Anki deck');
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(['Line 5: needs a front and a back.']);
    expect(stripHtml('a&nbsp;&amp;&lt;b&gt;')).toBe('a &<b>');
  });
});

describe('buildImportPack', () => {
  it('creates a draft pack with taxonomy, IDs and provenance', () => {
    const { rows } = csvRows(
      parseCsv(
        'type,topic,prompt,answer,options\nrecall,First steps,Q1?,A1,\nmcq,Second,Q2?,R,W1|W2|W3\nshort,First steps,Q3?,x|y,\n',
      ),
      'Lecture notes',
    );
    const p = buildImportPack(rows, {
      packId: 'neuro-101',
      title: 'Neuro 101',
      license: 'CC-BY-4.0',
      origin: 'Lecture notes',
      domain: { id: 'science', label: 'Science' },
      date: '2026-11-28',
    });
    expect(p.meta.provenance).toBe(
      'Imported from Lecture notes on 2026-11-28. All items are drafts until verified.',
    );
    expect(p.meta.domainPath).toEqual(['science', 'neuro-101']);
    expect(p.taxonomy.map((n) => n.id)).toEqual([
      'science',
      'neuro-101',
      'neuro-101-first-steps',
      'neuro-101-second',
    ]);
    const all = [...p.files.values()].flat();
    expect(all.map((q) => q.id)).toEqual([
      'neuro-101-imp-0001',
      'neuro-101-imp-0003',
      'neuro-101-imp-0002',
    ]);
    expect(all.every((q) => q.status === 'draft')).toBe(true);
    const mcq = all.find((q) => q.type === 'mcq');
    expect(mcq?.type === 'mcq' && mcq.options[mcq.answer]?.text).toBe('R');
    const short = all.find((q) => q.type === 'short');
    expect(short?.type === 'short' && short.answers).toEqual(['x', 'y']);
  });
});
