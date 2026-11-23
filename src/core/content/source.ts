import type { ContentIndex } from './contentIndex.ts';
import type { PackMeta, Question } from './types.ts';

/**
 * A pack as served to the app: metadata plus verified questions only
 * (drafts and retired items never enter reviews, SPEC 5.4).
 */
export interface PackContent {
  readonly meta: PackMeta;
  readonly questions: readonly Question[];
}

/** Where the app gets content from. Platform implements it (fetch on web). */
export interface ContentSource {
  loadIndex(): Promise<ContentIndex>;
  loadPack(packId: string): Promise<PackContent>;
}
