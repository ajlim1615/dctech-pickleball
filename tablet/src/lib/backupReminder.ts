export const BACKUP_REMINDER_DAYS = 14;

/** A nudge when the last backup is missing or over 14 days old; null when none is due. */
export function backupReminder(lastBackupAt: string | undefined, hasData: boolean, now = Date.now()): string | null {
  if (!hasData) return null;
  if (!lastBackupAt) return "No backup yet. Save one so you don't lose your players and results.";
  const days = Math.floor((now - new Date(lastBackupAt).getTime()) / 86_400_000);
  if (days <= BACKUP_REMINDER_DAYS) return null;
  return `Last backup: ${Math.floor(days / 7)} weeks ago.`;
}
