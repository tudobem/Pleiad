import type { ContentIndex, IndexPack } from './contentIndex.ts';
import type { PackMeta, Question, Thinker } from './types.ts';

/**
 * A pack as served to the app: metadata plus verified questions only
 * (drafts and retired items never enter reviews, SPEC 5.4).
 */
export interface PackContent {
  readonly meta: PackMeta;
  readonly questions: readonly Question[];
  /** Thinkers named by the pack's attribution questions. */
  readonly thinkers?: readonly Thinker[];
}

/** Where the app gets content from. Platform implements it (fetch on web). */
export interface ContentSource {
  loadIndex(): Promise<ContentIndex>;
  /** Fetch a pack's verified questions (lazy, SPEC 5.3). */
  loadPack(pack: IndexPack): Promise<PackContent>;
  /**
   * Keep exactly these pack files available offline: add missing ones and drop
   * the rest (older versions, inactive packs). Best effort; never throws.
   */
  keepOffline(files: readonly string[]): Promise<void>;
}
