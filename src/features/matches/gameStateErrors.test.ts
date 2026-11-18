import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GAME_STATE_ERRORS, gameStateErrorMessage } from "@/features/matches/utils/gameStateErrors";

describe("game-state error codes", () => {
  it("every code the SQL returns has a message, and every message has a code in SQL", () => {
    const dir = "supabase/migrations";
    const sql = readdirSync(dir)
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    const inSql = new Set([...sql.matchAll(/'error',\s*'([a-z_]+)'/g)].map((m) => m[1]));
    expect([...inSql].sort()).toEqual([...GAME_STATE_ERRORS].sort());
  });

  it.each([
    ["not_admin", "Only admins can do this."],
    ["bad_teams", "Each team needs the same number of players (1 or 2), and no one can be on both teams."],
    ["not_found", "That game or session no longer exists. Reload and try again."],
    ["session_not_active", "Start the session before calling players onto courts."],
    ["court_closed", "This court is closed. Reopen it before starting a game."],
    ["court_busy", "This court already has a game in progress. Save its score first."],
    ["player_busy", "One of these players is already in a game on another court."],
    ["line_changed", "The line changed while calling players. Try again."],
    ["game_not_live", "This game is no longer in progress."],
    ["swap_window_closed", "Players can only be swapped before the first point, in the first 5 minutes."],
    ["not_in_game", "That player isn't in this game."],
    ["no_replacement", "No one is waiting to swap in."],
    ["already_saved", "This game was already saved."],
    ["bad_status", "A session can only be ended or cancelled here."],
    ["in_other_card", "That player is already in another Up Next match."],
    ["not_waiting", "That player isn't waiting in line."],
    ["teams_incomplete", "Fill every slot before starting or saving this game."],
    ["wrong_court", "This match is set for a different court."],
  ])("%s has its copy", (code, text) => {
    expect(gameStateErrorMessage(code)).toBe(text);
  });

  it("falls back for unknown or missing codes", () => {
    const fallback = "That couldn't be saved. Nothing was changed; please try again.";
    expect(gameStateErrorMessage("nope")).toBe(fallback);
    expect(gameStateErrorMessage(undefined)).toBe(fallback);
  });
});
