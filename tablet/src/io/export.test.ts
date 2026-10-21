import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildWorkbook, exportFileName, exportRows } from "./export";
import { checkIn, startGame, finishGame, activeGameOnCourt } from "../engine/game";
import { makeCtx, makeState } from "../engine/fixtures";
import { isEngineError, type DeskSession, type SessionState } from "../engine/types";

function ok(value: SessionState | { error: string }): SessionState {
  if (isEngineError(value)) throw new Error(value.error);
  return value;
}

function playedSession(overrides: Partial<DeskSession> = {}) {
  const ctx = makeCtx();
  let s = checkIn(makeState(8, { courts: [{ id: "c1", name: "Court 1", closed: false }], ...overrides }), ["p1", "p2", "p3", "p4"], ctx);
  s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
  const result = overrides.trackScores === false ? { winner: "A" as const } : { scoreA: 11, scoreB: 6 };
  return ok(finishGame(s, activeGameOnCourt(s, "c1")!.id, result, ctx));
}

describe("export", () => {
  it("drops points columns when scores are off", () => {
    const rows = exportRows(playedSession({ trackScores: false }));
    expect(rows.leaderboard[0]).toEqual(["Rank", "Player", "Played", "Won", "Lost"]);
    expect(rows.games[1][4]).toBe("Win/loss only");
  });

  it("lists games in order with team names", () => {
    const rows = exportRows(playedSession());
    expect(rows.leaderboard[0]).toEqual(["Rank", "Player", "Played", "Won", "Lost", "Points for", "Points against", "Diff"]);
    expect(rows.games[0]).toEqual(["#", "Court", "Team 1", "Team 2", "Score", "Winner", "Started", "Ended"]);
    expect(rows.games[1].slice(0, 6)).toEqual([1, "Court 1", "Player 1 & Player 2", "Player 3 & Player 4", "11 - 6", "Team 1"]);
  });

  it('exportFileName is "Pickleball – Tuesday open play – 2026-10-21.xlsx"', () => {
    expect(exportFileName(makeState().session)).toBe("Pickleball – Tuesday open play – 2026-10-21.xlsx");
  });

  it("builds a workbook with Leaderboard and Games sheets", () => {
    const book = XLSX.read(buildWorkbook(playedSession()), { type: "array" });
    expect(book.SheetNames).toEqual(["Leaderboard", "Games"]);
  });
});
