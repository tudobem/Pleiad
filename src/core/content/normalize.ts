/** Text normalization shared by content rules (pure, no locale APIs). */

export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\$[^$]*\$/g, ' ') // drop inline LaTeX
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(' ')
      .filter((t) => t.length > 0),
  );
}

/** Jaccard similarity of the normalized token sets, 0..1. */
export function jaccard(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

const CATCH_ALL = /^(all|none|both|neither) of (the )?(above|these|the above|them)$/;

/** True for options like "All of the above" or "None of these" (SPEC 5.5). */
export function isCatchAllOption(text: string): boolean {
  return CATCH_ALL.test(normalizeText(text));
}

/** Locale-independent string order, so generated files are identical everywhere. */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Locale-independent label order: ignoring case first, then by code point. */
export function compareLabels(a: string, b: string): number {
  return compareStrings(a.toLowerCase(), b.toLowerCase()) || compareStrings(a, b);
}
