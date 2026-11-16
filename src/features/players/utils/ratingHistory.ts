import type { PlayerRatingHistory } from "@/types";

type HistoryRow = Pick<PlayerRatingHistory, "reason" | "match_id" | "rating_change">;

/** An admin's manual rating edit: it moves the rating but is not a game. */
export function isAdminAdjustment(row: Pick<HistoryRow, "reason" | "match_id">): boolean {
  return row.reason === "admin" || row.match_id === null;
}

/** Only the rows that came from a game (including corrected games). */
export function gameRows<T extends Pick<HistoryRow, "reason" | "match_id">>(rows: T[]): T[] {
  return rows.filter((r) => !isAdminAdjustment(r));
}

/** The change from the most recent game, ignoring admin edits. 0 when no game yet. */
export function lastGameChange(rows: HistoryRow[]): number {
  const games = gameRows(rows);
  const last = games[games.length - 1];
  return last ? Number(last.rating_change) : 0;
}
