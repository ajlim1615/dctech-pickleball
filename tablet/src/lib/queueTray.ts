import type { DeskQueueEntry } from "../engine/types";

/**
 * Which line row has its action tray open. A tray closes by itself once its row
 * leaves the line (the player went on court, on a break or home), so an action
 * never lands on a stale row.
 */
export function trayFor(openEntryId: string | null, line: DeskQueueEntry[]): string | null {
  return openEntryId && line.some((q) => q.id === openEntryId) ? openEntryId : null;
}
