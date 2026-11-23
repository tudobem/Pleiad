/** Split text into plain and inline-LaTeX parts: "a $x$ b" -> a, x (math), b. */
export interface TextPart {
  readonly value: string;
  readonly math: boolean;
}

export function splitMath(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /\$([^$\n]+)\$/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ value: text.slice(last, start), math: false });
    parts.push({ value: match[1] ?? '', math: true });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ value: text.slice(last), math: false });
  return parts;
}
