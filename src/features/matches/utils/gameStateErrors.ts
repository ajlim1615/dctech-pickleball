import { NO_SHOW_WINDOW_MINUTES } from "@/features/queue/utils/noShow";

/**
 * Every code the game-state procedures (start_match, swap_match_player,
 * finish_match, close_session) return as { error: code }. gameStateErrors.test.ts
 * keeps this list and the SQL in step: add a code in both places.
 */
export const GAME_STATE_ERRORS = [
  "not_admin",
  "bad_teams",
  "not_found",
  "session_not_active",
  "court_closed",
  "court_busy",
  "player_busy",
  "line_changed",
  "game_not_live",
  "swap_window_closed",
  "not_in_game",
  "no_replacement",
  "already_saved",
  "bad_status",
  "in_other_card",
  "not_waiting",
  "teams_incomplete",
  "wrong_court",
  "same_team",
  "slot_full",
  "undo_stale",
  "undo_expired",
] as const;

export type GameStateError = (typeof GAME_STATE_ERRORS)[number];

const MESSAGES: Record<GameStateError, string> = {
  not_admin: "Only admins can do this.",
  bad_teams: "Each team needs the same number of players (1 or 2), and no one can be on both teams.",
  not_found: "That game or session no longer exists. Reload and try again.",
  session_not_active: "Start the session before calling players onto courts.",
  court_closed: "This court is closed. Reopen it before starting a game.",
  court_busy: "This court already has a game in progress. Save its score first.",
  player_busy: "One of these players is already in a game on another court.",
  line_changed: "The line changed while calling players. Try again.",
  game_not_live: "This game is no longer in progress.",
  swap_window_closed: `Players can only be swapped before the first point, in the first ${NO_SHOW_WINDOW_MINUTES} minutes.`,
  not_in_game: "That player isn't in this game.",
  no_replacement: "No one is waiting to swap in.",
  already_saved: "This game was already saved.",
  bad_status: "A session can only be ended or cancelled here.",
  in_other_card: "That player is already in another Up Next match.",
  not_waiting: "That player isn't waiting in line.",
  teams_incomplete: "Fill every slot before starting or saving this game.",
  wrong_court: "This match is set for a different court.",
  same_team: "Those two players are already on the same team.",
  slot_full: "That team is already full.",
  undo_stale: "Too late to undo — something else changed on this court.",
  undo_expired: "Undo is only available for 10 seconds.",
};

const FALLBACK = "That couldn't be saved. Nothing was changed; please try again.";

export function isGameStateError(code: unknown): code is GameStateError {
  return typeof code === "string" && (GAME_STATE_ERRORS as readonly string[]).includes(code);
}

/** The message for a procedure's error code; unknown codes are logged and get a generic message. */
export function gameStateErrorMessage(code: string | undefined): string {
  if (isGameStateError(code)) return MESSAGES[code];
  if (code !== undefined) console.error("Unknown game-state error code:", code);
  return FALLBACK;
}
