/** A cloze sentence split into text and blanks: "a {{x}} b" -> "a ", blank x, " b". */
export type ClozePart =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'blank'; readonly index: number; readonly answer: string };

export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  const re = /\{\{([^{}]*)\}\}/g;
  let last = 0;
  let index = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ kind: 'text', value: text.slice(last, start) });
    parts.push({ kind: 'blank', index, answer: (m[1] ?? '').trim() });
    index += 1;
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

export function clozeAnswers(text: string): string[] {
  return parseCloze(text).flatMap((p) => (p.kind === 'blank' ? [p.answer] : []));
}
