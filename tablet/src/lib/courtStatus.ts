import type { DeskCourt } from "../engine/types";

/**
 * What a court card's close button and status say. Closing a court with a game running
 * lets that game finish, so the card must show it's closing, not look unchanged.
 */
export function courtControls(court: DeskCourt, hasGame: boolean): { toggleLabel: string; notice: string | null } {
  if (!court.closed) return { toggleLabel: "Close court", notice: null };
  return { toggleLabel: "Reopen", notice: hasGame ? "Closing after this game" : "Closed" };
}
