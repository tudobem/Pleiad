import type { DBSchema } from 'idb';
import type { ReviewEvent } from '../../core/sync/reviewEvent.ts';

/** A stored review: the event plus a local insertion sequence number. */
export type StoredReview = ReviewEvent & { readonly seq: number };

export interface PleiadDB extends DBSchema {
  cards: { key: string; value: unknown };
  settings: { key: string; value: unknown };
  notes: { key: string; value: unknown };
  flags: { key: string; value: unknown };
  meta: { key: string; value: unknown };
  reviews: {
    key: string;
    value: StoredReview;
    indexes: { 'by-ts': number; 'by-card': string; 'by-seq': number };
  };
}
