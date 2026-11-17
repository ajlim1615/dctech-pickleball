import type { QueueStatus } from "@/types";

/**
 * Queue entry statuses, in one place.
 *
 * - Active (holds the player's one place in this session) = any status except "left".
 *   The database enforces one active entry per (session, player) with exactly that
 *   rule, so a status added later counts as active by default. Query it with
 *   `.neq("status", "left")`.
 * - In line (active but not on a court) = LINE_STATUSES. Query it with
 *   `.in("status", LINE_STATUSES)`.
 */
export const LINE_STATUSES = ["waiting", "called", "on_break"] as const satisfies readonly QueueStatus[];

export function isInLine(status: string): boolean {
  return (LINE_STATUSES as readonly string[]).includes(status);
}
