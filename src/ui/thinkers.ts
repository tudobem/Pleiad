import type { Thinker } from '../core/content/types.ts';

/**
 * Thinkers named by the loaded packs' attribution questions (SPEC 6). Filled
 * as pack files load; attribution answers look names up here.
 */
const known = new Map<string, Thinker>();

export function registerThinkers(list: readonly Thinker[] | undefined): void {
  for (const t of list ?? []) known.set(t.id, t);
}

/** The thinker for an ID; falls back to the ID itself so an option never shows blank. */
export function thinker(id: string): Thinker {
  return known.get(id) ?? { id, name: id };
}
