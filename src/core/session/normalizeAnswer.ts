/**
 * Short-answer comparison (SPEC 6): case, whitespace, punctuation and
 * diacritics are ignored, simple plurals match their singular, and numbers
 * compare by value.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,-]/gu, ' ')
    .replace(/[.,-](?!\d)|(?<!\d)[.,-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .join(' ');
}

/** True if two words are equal or differ only by a simple English plural. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 3 || /\d/.test(short)) return false;
  return (
    long === `${short}s` ||
    long === `${short}es` ||
    (short.endsWith('y') && long === `${short.slice(0, -1)}ies`)
  );
}

/** Compare two answers word by word after normalization. */
export function answersMatch(given: string, expected: string): boolean {
  const g = normalizeAnswer(given).split(' ');
  const e = normalizeAnswer(expected).split(' ');
  return g.length === e.length && g.every((w, i) => sameWord(w, e[i] ?? ''));
}

/**
 * Parse a typed number: "1000", "1,000", "1 000", "1.5", "1,5", "-3", "2e9".
 * A single comma followed by 1-2 digits is a decimal comma; otherwise commas
 * and spaces group thousands. Returns null for anything else.
 */
export function parseNumber(text: string): number | null {
  let t = text.trim().replace(/\s+/g, '');
  if (t === '') return null;
  if (/^-?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,(?=\d{3}(\D|$))/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
