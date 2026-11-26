import { fsrsScheduler } from '../scheduler/fsrsScheduler.ts';
import { normalizeSettings, type Settings } from '../settings.ts';
import type { StorageSnapshot } from '../storage.ts';
import { compareEvents, replayCards } from '../sync/replay.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';
import type { Backup, KeyValues } from './format.ts';

/** Meta keys that never survive a restore (they describe local, transient state). */
const TRANSIENT_META = new Set(['activeSession']);
/** Settings key the learning settings are stored under (src/ui/learning.ts). */
const LEARNING_KEY = 'learning';

export interface RestoreSummary {
  /** Answers in the backup file. */
  readonly inFile: number;
  /** Answers added to this device. */
  readonly added: number;
  /** Answers this device already had. */
  readonly kept: number;
  /** Same eventId on both sides with different content (the local copy is kept). */
  readonly conflicts: number;
  /** Answers on this device after the restore. */
  readonly total: number;
}

export interface RestorePlan {
  readonly snapshot: StorageSnapshot;
  readonly summary: RestoreSummary;
}

type Entries = readonly (readonly [string, unknown])[];

/** JSON with sorted keys, to compare events regardless of key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const entriesOf = (kv: KeyValues): Entries => Object.entries(kv);

/** Local entries first; the backup only fills keys this device does not have. */
function mergeEntries(local: Entries, fromFile: KeyValues): Entries {
  const keys = new Set(local.map(([k]) => k));
  return [...local, ...Object.entries(fromFile).filter(([k]) => !keys.has(k))];
}

function learningSettings(entries: Entries): Settings {
  const stored = entries.find(([k]) => k === LEARNING_KEY)?.[1];
  return normalizeSettings(stored as Partial<Settings> | undefined);
}

/** Card state is derived: rebuild it from the log (SPEC 3.3). */
function withReplayedCards(
  reviews: ReviewEvent[],
  stores: Omit<StorageSnapshot['stores'], 'cards'>,
): StorageSnapshot {
  const sorted = [...reviews].sort(compareEvents);
  const scheduler = fsrsScheduler(learningSettings(stores.settings).desiredRetention);
  const cards = [...replayCards(sorted, scheduler)].map(([id, card]) => [id, card] as const);
  return { reviews: sorted, stores: { ...stores, cards } };
}

const localMeta = (current: StorageSnapshot): Entries =>
  current.stores.meta.filter(([k]) => !TRANSIENT_META.has(k));

/**
 * Replace: this device takes the backup's answers, settings, notes and flags.
 * It keeps its own device ID and local meta, and takes the backup's profile.
 */
export function planReplace(current: StorageSnapshot, backup: Backup): RestorePlan {
  const meta: (readonly [string, unknown])[] = [
    ...localMeta(current).filter(([k]) => k !== 'profileId'),
    ['profileId', backup.profileId],
  ];
  const snapshot = withReplayedCards([...backup.reviews], {
    settings: entriesOf(backup.settings),
    notes: entriesOf(backup.notes),
    flags: entriesOf(backup.flags),
    meta,
  });
  return {
    snapshot,
    summary: {
      inFile: backup.reviews.length,
      added: backup.reviews.length,
      kept: 0,
      conflicts: 0,
      total: snapshot.reviews.length,
    },
  };
}

/**
 * Merge: the union of both logs by eventId (SPEC 19). Local data wins on any
 * conflict; the backup only adds what this device does not have.
 */
export function planMerge(current: StorageSnapshot, backup: Backup): RestorePlan {
  const local = new Map(current.reviews.map((e) => [e.eventId, e]));
  const added: ReviewEvent[] = [];
  let conflicts = 0;
  for (const e of backup.reviews) {
    const mine = local.get(e.eventId);
    if (!mine) added.push(e);
    else if (canonical(mine) !== canonical(e)) conflicts += 1;
  }
  const snapshot = withReplayedCards([...current.reviews, ...added], {
    settings: mergeEntries(current.stores.settings, backup.settings),
    notes: mergeEntries(current.stores.notes, backup.notes),
    flags: mergeEntries(current.stores.flags, backup.flags),
    meta: current.stores.meta,
  });
  return {
    snapshot,
    summary: {
      inFile: backup.reviews.length,
      added: added.length,
      kept: current.reviews.length,
      conflicts,
      total: snapshot.reviews.length,
    },
  };
}

export type RestoreMode = 'replace' | 'merge';
