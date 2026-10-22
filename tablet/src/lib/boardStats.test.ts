import { describe, it, expect } from "vitest";
import { boardStats } from "./boardStats";
import { sessionHighlights } from "./sessionHighlights";
import { activeGameOnCourt, checkIn, finishGame, startGame } from "../engine/game";
import { setBreak, markLeft } from "../engine/queue";
import { makeCtx, makeState } from "../engine/fixtures";
import { isEngineError, type SessionState } from "../engine/types";

function ok(value: SessionState | { error: string }): SessionState {
  if (isEngineError(value)) throw new Error(value.error);
  return value;
}

const oneCourt = { courts: [{ id: "c1", name: "Court 1", closed: false }] };

describe("boardStats", () => {
  it("counts playing, in line and finished games", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, oneCourt), ["p1", "p2", "p3", "p4", "p5", "p6"], ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    s = ok(finishGame(s, activeGameOnCourt(s, "c1")!.id, { scoreA: 11, scoreB: 4 }, ctx));
    expect(boardStats(s)).toEqual({ playing: 4, inLine: 2, games: 1 });
  });

  it("leaves out players on a break or gone home", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, oneCourt), ["p1", "p2", "p3"], ctx);
    s = ok(setBreak(s, "p1", true, ctx));
    s = ok(markLeft(s, "p2", ctx));
    expect(boardStats(s)).toEqual({ playing: 0, inLine: 1, games: 0 });
  });
});

describe("sessionHighlights", () => {
  it("has no top player before any games", () => {
    expect(sessionHighlights(makeState())).toEqual({ games: 0 });
  });

  it("names the night's top player with their record", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, oneCourt), ["p1", "p2", "p3", "p4"], ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    s = ok(finishGame(s, activeGameOnCourt(s, "c1")!.id, { scoreA: 11, scoreB: 4 }, ctx));
    const second = activeGameOnCourt(s, "c1")!;
    const p1Team = second.teamA.includes("p1") ? "A" : "B";
    s = ok(finishGame(s, second.id, p1Team === "A" ? { scoreA: 11, scoreB: 6 } : { scoreA: 6, scoreB: 11 }, ctx));
    // p1 and p2 partner twice with four players, so either can top the table at 2–0.
    const highlights = sessionHighlights(s);
    expect(highlights).toMatchObject({ games: 2, top: { won: 2, lost: 0 } });
    expect(["Player 1", "Player 2"]).toContain(highlights.top!.name);
  });
});
