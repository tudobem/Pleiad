import type { StorageSnapshot } from '../storage.ts';
import type { ReviewEvent } from '../sync/reviewEvent.ts';

/**
 * Backup file format (SPEC 19). Plain JSON: the review log (the source of
 * truth) plus the small user stores. Card state is not included; it is
 * rebuilt by replaying the log on import.
 */
export const BACKUP_FORMAT = 'pleiad-backup';
export const BACKUP_SCHEMA_VERSION = 1;
/** Refuse files larger than this before parsing (25 MB). */
export const BACKUP_MAX_BYTES = 25 * 1024 * 1024;

export type KeyValues = Readonly<Record<string, unknown>>;

export interface Backup {
  readonly format: typeof BACKUP_FORMAT;
  readonly schema_version: number;
  /** UTC ms when the file was written. */
  readonly exportedAt: number;
  readonly appVersion: string;
  readonly profileId: string;
  readonly reviews: readonly ReviewEvent[];
  readonly settings: KeyValues;
  readonly notes: KeyValues;
  readonly flags: KeyValues;
}

export interface BackupMeta {
  readonly exportedAt: number;
  readonly appVersion: string;
  readonly profileId: string;
}

export function buildBackup(snapshot: StorageSnapshot, meta: BackupMeta): Backup {
  const obj = (entries: readonly (readonly [string, unknown])[]): KeyValues =>
    Object.fromEntries(entries);
  return {
    format: BACKUP_FORMAT,
    schema_version: BACKUP_SCHEMA_VERSION,
    exportedAt: meta.exportedAt,
    appVersion: meta.appVersion,
    profileId: meta.profileId,
    reviews: snapshot.reviews,
    settings: obj(snapshot.stores.settings),
    notes: obj(snapshot.stores.notes),
    flags: obj(snapshot.stores.flags),
  };
}

export type BackupError =
  'too-large' | 'not-json' | 'not-a-backup' | 'newer-version' | 'invalid-content';

export type ParseResult =
  | { readonly ok: true; readonly backup: Backup }
  | { readonly ok: false; readonly error: BackupError; readonly detail?: string };

/**
 * Upgrades for older backup files, keyed by the version they upgrade from.
 * Version 1 is the first; add `1: (raw) => ...` when version 2 arrives.
 */
const MIGRATIONS: Readonly<
  Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>
> = {};

const RATINGS = new Set(['again', 'hard', 'good', 'easy']);
const MODES = new Set(['scheduled', 'extra']);
const CONFIDENCES = new Set(['guess', 'fairly_sure', 'certain']);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Why an event is invalid, or undefined when it is a valid ReviewEvent. */
export function eventProblem(v: unknown): string | undefined {
  if (!isRecord(v)) return 'not an object';
  for (const key of ['eventId', 'profileId', 'deviceId', 'cardId', 'type', 'appVersion']) {
    if (!isText(v[key])) return `missing ${key}`;
  }
  if (!isNumber(v.ts)) return 'missing ts';
  if (typeof v.mode !== 'string' || !MODES.has(v.mode)) return 'unknown mode';
  if (typeof v.correct !== 'boolean') return 'missing correct';
  if (typeof v.rating !== 'string' || !RATINGS.has(v.rating)) return 'unknown rating';
  if (!isNumber(v.responseMs) || v.responseMs < 0) return 'missing responseMs';
  if (
    v.confidence !== undefined &&
    (typeof v.confidence !== 'string' || !CONFIDENCES.has(v.confidence))
  ) {
    return 'unknown confidence';
  }
  if (!('schedulerStateBefore' in v) || !('schedulerStateAfter' in v)) {
    return 'missing scheduler state';
  }
  return undefined;
}

/** Parse and validate a backup file. Nothing is accepted partially. */
export function parseBackup(text: string): ParseResult {
  if (text.length > BACKUP_MAX_BYTES) return { ok: false, error: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT || !isNumber(raw.schema_version)) {
    return { ok: false, error: 'not-a-backup' };
  }
  if (raw.schema_version > BACKUP_SCHEMA_VERSION) return { ok: false, error: 'newer-version' };

  let data: Record<string, unknown> = raw;
  for (let v = raw.schema_version; v < BACKUP_SCHEMA_VERSION; v += 1) {
    const up = MIGRATIONS[v];
    if (!up) return { ok: false, error: 'not-a-backup', detail: `no upgrade from version ${v}` };
    data = up(data);
  }

  const invalid = (detail: string): ParseResult => ({
    ok: false,
    error: 'invalid-content',
    detail,
  });
  if (!Array.isArray(data.reviews)) return invalid('reviews is not a list');
  const ids = new Set<string>();
  for (let i = 0; i < data.reviews.length; i += 1) {
    const problem = eventProblem(data.reviews[i]);
    if (problem) return invalid(`answer ${i + 1}: ${problem}`);
    const id = (data.reviews[i] as ReviewEvent).eventId;
    if (ids.has(id)) return invalid(`answer ${i + 1}: duplicate eventId`);
    ids.add(id);
  }
  for (const key of ['settings', 'notes', 'flags']) {
    if (data[key] !== undefined && !isRecord(data[key])) return invalid(`${key} is not an object`);
  }
  if (!isText(data.profileId)) return invalid('missing profileId');

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      schema_version: BACKUP_SCHEMA_VERSION,
      exportedAt: isNumber(data.exportedAt) ? data.exportedAt : 0,
      appVersion: typeof data.appVersion === 'string' ? data.appVersion : '',
      profileId: data.profileId,
      reviews: data.reviews as ReviewEvent[],
      settings: (data.settings as KeyValues | undefined) ?? {},
      notes: (data.notes as KeyValues | undefined) ?? {},
      flags: (data.flags as KeyValues | undefined) ?? {},
    },
  };
}
