import type { DeskCourt, DeskGame } from "../engine/types";
import type { Suggestion } from "../engine/game";

export type PillTone = "neutral" | "live" | "warn";

/** The status pill beside a court's name. */
export function courtPill(
  court: DeskCourt,
  game: DeskGame | undefined,
  suggestion: Suggestion | undefined,
  nowMs: number
): { label: string; tone: PillTone; minutes?: number } {
  if (game && court.closed) return { label: "Closing after this game", tone: "warn" };
  if (game) {
    const minutes = Math.max(0, Math.floor((nowMs - Date.parse(game.startedAt)) / 60_000));
    return { label: `${minutes} min`, tone: "live", minutes };
  }
  if (court.closed) return { label: "Closed", tone: "neutral" };
  if (suggestion && "hold" in suggestion) return { label: "Waiting for a skill match", tone: "warn" };
  if (suggestion && "waitingFor" in suggestion) return { label: `Needs ${suggestion.waitingFor} more`, tone: "neutral" };
  if (suggestion) return { label: "Up next", tone: "neutral" };
  return { label: "Needs 4 more", tone: "neutral" };
}

/**
 * What a court card's close button and status say. Closing a court with a game running
 * lets that game finish, so the card must show it's closing, not look unchanged.
 */
export function courtControls(court: DeskCourt, hasGame: boolean): { toggleLabel: string; notice: string | null } {
  if (!court.closed) return { toggleLabel: "Close court", notice: null };
  return { toggleLabel: "Reopen", notice: hasGame ? "Closing after this game" : "Closed" };
}
