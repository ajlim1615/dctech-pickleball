import type { Session, SessionStatus } from "@/types";

const STATUS_PRIORITY: Record<SessionStatus, number> = {
  active: 0,
  scheduled: 1,
  completed: 2,
  cancelled: 3,
};

/**
 * Orders sessions for players and organizers:
 * 1. `active` (soonest start first)
 * 2. `scheduled` (soonest start first)
 * 3. `completed` (most recent first)
 * 4. `cancelled` (most recent first)
 */
export function sortSessionsForDisplay<T extends Pick<Session, "status" | "start_time">>(
  sessions: T[]
): T[] {
  return sessions.toSorted((a, b) => {
    const rankDiff = (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    const aMs = Date.parse(a.start_time) || 0;
    const bMs = Date.parse(b.start_time) || 0;
    // Live & upcoming: soonest first; past: most recent first
    return a.status === "active" || a.status === "scheduled" ? aMs - bMs : bMs - aMs;
  });
}
