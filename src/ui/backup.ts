import { buildBackup, parseBackup, type BackupError } from '../core/backup/format.ts';
import { backupDue } from '../core/backup/reminder.ts';
import {
  planMerge,
  planReplace,
  type RestoreMode,
  type RestoreSummary,
} from '../core/backup/restore.ts';
import { readSnapshot } from '../core/backup/snapshot.ts';
import type { SaveResult } from '../core/device.ts';
import type { Services } from './services.ts';

export const LAST_BACKUP_KEY = 'lastBackup';
export const TAB_NOTICE_KEY = 'browserTabNoticeDismissed';

/** Local calendar date (YYYY-MM-DD) for file names. */
function localDate(services: Services, at: number): string {
  const shifted = at + services.clock.utcOffsetMinutes(at) * 60_000;
  return new Date(shifted).toISOString().slice(0, 10);
}

export interface ExportResult {
  readonly result: SaveResult;
  readonly answers: number;
}

/** Export everything as one JSON file (SPEC 19) and remember when. */
export async function exportBackup(services: Services): Promise<ExportResult> {
  const now = services.clock.now();
  const snapshot = await readSnapshot(services.storage);
  const backup = buildBackup(snapshot, {
    exportedAt: now,
    appVersion: services.appVersion,
    profileId: services.identity.profileId,
  });
  const result = await services.device.saveFile(
    `pleiad-backup-${localDate(services, now)}.json`,
    `${JSON.stringify(backup)}\n`,
  );
  if (result !== 'cancelled') await services.storage.put('meta', LAST_BACKUP_KEY, now);
  return { result, answers: backup.reviews.length };
}

export type ImportResult =
  | { readonly ok: true; readonly summary: RestoreSummary }
  | { readonly ok: false; readonly error: BackupError | 'write-failed'; readonly detail?: string };

/** Peek at a file before importing: how many answers and from when. */
export function describeBackup(text: string) {
  const parsed = parseBackup(text);
  return parsed.ok
    ? {
        ok: true as const,
        answers: parsed.backup.reviews.length,
        exportedAt: parsed.backup.exportedAt,
      }
    : parsed;
}

/**
 * Import a backup (SPEC 19): the new state is computed completely, then
 * written in one transaction, so a failure changes nothing.
 */
export async function importBackup(
  services: Services,
  text: string,
  mode: RestoreMode,
): Promise<ImportResult> {
  const parsed = parseBackup(text);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, ...(parsed.detail ? { detail: parsed.detail } : {}) };
  }
  const current = await readSnapshot(services.storage);
  const plan =
    mode === 'replace' ? planReplace(current, parsed.backup) : planMerge(current, parsed.backup);
  try {
    await services.storage.replaceAll(plan.snapshot);
  } catch {
    return { ok: false, error: 'write-failed' };
  }
  services.device.writeUsage(plan.summary.total);
  return { ok: true, summary: plan.summary };
}

export type Notice = 'data-loss' | 'browser-tab' | 'backup-due';

/** The one notice Today shows, by priority (SPEC 18, 19), or none. */
export async function currentNotice(
  services: Services,
  answers: number,
  firstAnswerTs: number | undefined,
): Promise<Notice | undefined> {
  const { device, storage, clock } = services;
  if (answers === 0 && device.readUsage() > 0) return 'data-loss';
  if (answers > 0) device.writeUsage(answers);
  if (!device.isStandalone() && !(await storage.get<boolean>('meta', TAB_NOTICE_KEY))) {
    return 'browser-tab';
  }
  const last = await storage.get<number>('meta', LAST_BACKUP_KEY);
  return backupDue(typeof last === 'number' ? last : undefined, firstAnswerTs, clock.now())
    ? 'backup-due'
    : undefined;
}
