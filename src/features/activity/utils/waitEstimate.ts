import type { SessionEvent, SessionEventType } from "@/types";

const DEFAULT_GAME_MINUTES = 12;

/**
 * Rough wait for a player at `position` in line (1 = first, on-break players
 * already excluded): groups of four ahead, shared across the courts in play.
 */
export function estimateWait(input: {
  position: number | null;
  courtsInPlay: number;
  avgGameMinutes: number | null;
}): { groupsAhead: number; minutes: number; nextGame: boolean } {
  const position = Math.max(1, input.position ?? 1);
  const groupsAhead = Math.max(0, Math.ceil(position / 4) - 1);
  const courts = Math.max(1, input.courtsInPlay);
  const perGame = input.avgGameMinutes ?? DEFAULT_GAME_MINUTES;
  return { groupsAhead, minutes: Math.ceil(groupsAhead / courts) * perGame, nextGame: groupsAhead === 0 };
}

const AFFECTING: SessionEventType[] = [
  "moved_in_queue",
  "removed_from_queue",
  "no_show_swapped",
  "players_swapped",
  "break_started",
  "break_ended",
  "game_started",
  "game_result",
  "result_corrected",
];

/** The latest events that changed things for this player, newest first. */
export function eventsAffecting(events: SessionEvent[], playerId: string, limit = 5): SessionEvent[] {
  return events
    .filter((e) => AFFECTING.includes(e.type) && e.subject_ids.includes(playerId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
