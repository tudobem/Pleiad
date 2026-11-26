import { DAY_MS } from '../scheduler/day.ts';

/** SPEC 19: remind when the last export is older than this. */
export const BACKUP_REMINDER_DAYS = 7;

/**
 * Whether to show the backup reminder: there are answers, and the last export
 * (or, if there was none, the first answer) is more than 7 days old.
 */
export function backupDue(
  lastBackupTs: number | undefined,
  firstReviewTs: number | undefined,
  now: number,
): boolean {
  if (firstReviewTs === undefined) return false;
  const since = lastBackupTs ?? firstReviewTs;
  return now - since > BACKUP_REMINDER_DAYS * DAY_MS;
}
