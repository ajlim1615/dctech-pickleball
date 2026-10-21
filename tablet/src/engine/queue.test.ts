import { describe, it, expect } from "vitest";
import { checkIn, finishGame, startGame, activeGameOnCourt, waitingLine } from "./game";
import { moveInQueue, setBreak, markLeft, swapPlayerInGame, setCourtClosed, endSession } from "./queue";
import { makeCtx, makeState } from "./fixtures";
import { isEngineError, type SessionState } from "./types";

function ok(value: SessionState | { error: string }): SessionState {
  if (isEngineError(value)) throw new Error(value.error);
  return value;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const oneCourt = { courts: [{ id: "c1", name: "Court 1", closed: false }] };
const statusOf = (s: SessionState, id: string) => s.queue.find((q) => q.playerId === id)!.status;
const line = (s: SessionState) => waitingLine(s).map((q) => q.playerId);

/** One court, p1–p4 playing, the rest of `count` waiting. */
function playing(count = 6) {
  const ctx = makeCtx();
  let s = checkIn(makeState(9, oneCourt), ids(count), ctx);
  s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
  return { s, ctx, gameId: activeGameOnCourt(s, "c1")!.id };
}

describe("queue actions", () => {
  it("moveInQueue moves a waiting player to index 0", () => {
    const ctx = makeCtx();
    const s = checkIn(makeState(), ids(4), ctx);
    const p3 = s.queue.find((q) => q.playerId === "p3")!;
    expect(line(ok(moveInQueue(s, p3.id, 0)))).toEqual(["p3", "p1", "p2", "p4"]);
  });

  it("setBreak on a playing player defers until their game finishes", () => {
    let { s, ctx, gameId } = playing();
    s = ok(setBreak(s, "p1", true, ctx));
    expect(statusOf(s, "p1")).toBe("playing");
    s = ok(finishGame(s, gameId, { scoreA: 11, scoreB: 4 }, ctx));
    expect(statusOf(s, "p1")).toBe("on_break");
  });

  it("markLeft on a playing player keeps them in the game and does not re-queue them", () => {
    let { s, ctx, gameId } = playing();
    s = ok(markLeft(s, "p2", ctx));
    expect(statusOf(s, "p2")).toBe("playing");
    s = ok(finishGame(s, gameId, { scoreA: 11, scoreB: 4 }, ctx));
    expect(statusOf(s, "p2")).toBe("left");
    expect(line(s)).not.toContain("p2");
  });

  it("ending a break puts the player at the back and fills a free court", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, oneCourt), ids(4), ctx);
    s = ok(setBreak(s, "p4", true, ctx));
    expect(activeGameOnCourt(s, "c1")).toBeUndefined();
    s = ok(setBreak(s, "p4", false, ctx));
    const game = activeGameOnCourt(s, "c1")!;
    expect([...game.teamA, ...game.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("swapPlayerInGame refuses a finished game", () => {
    let { s, ctx, gameId } = playing(8);
    s = ok(finishGame(s, gameId, { scoreA: 11, scoreB: 4 }, ctx));
    expect(isEngineError(swapPlayerInGame(s, gameId, "p1", "p5", ctx))).toBe(true);
  });

  it("swap returns the swapped-out player to the front", () => {
    let { s, ctx, gameId } = playing(6);
    s = ok(swapPlayerInGame(s, gameId, "p1", "p6", ctx));
    const game = s.games.find((g) => g.id === gameId)!;
    expect(game.teamA).toEqual(["p6", "p2"]);
    expect(statusOf(s, "p6")).toBe("playing");
    expect(line(s)).toEqual(["p1", "p5"]);
  });

  it("closing a court with a game running keeps the game and skips refill after it finishes", () => {
    let { s, ctx, gameId } = playing(8);
    s = ok(setCourtClosed(s, "c1", true, ctx));
    expect(activeGameOnCourt(s, "c1")?.id).toBe(gameId);
    s = ok(finishGame(s, gameId, { scoreA: 11, scoreB: 4 }, ctx));
    expect(activeGameOnCourt(s, "c1")).toBeUndefined();
    s = ok(setCourtClosed(s, "c1", false, ctx));
    expect(activeGameOnCourt(s, "c1")).toBeDefined();
  });

  it("winners_stay refills the finished court first so another court can't take its winners", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, { matchingStyle: "winners_stay" }), ids(7), ctx);
    s = ok(setCourtClosed(s, "c1", true, ctx));
    s = ok(startGame(s, "c2", { teamA: ["p1", "p4"], teamB: ["p2", "p3"] }, ctx));
    s = ok(setCourtClosed(s, "c1", false, ctx));
    expect(activeGameOnCourt(s, "c1")).toBeUndefined();
    s = ok(finishGame(s, activeGameOnCourt(s, "c2")!.id, { scoreA: 11, scoreB: 5 }, ctx));
    const next = activeGameOnCourt(s, "c2")!;
    expect([...next.teamA, ...next.teamB]).toEqual(expect.arrayContaining(["p1", "p4"]));
    expect(activeGameOnCourt(s, "c1")).toBeUndefined();
  });

  it("endSession keeps unfinished games without a winner", () => {
    let { s, ctx, gameId } = playing();
    s = ok(endSession(s, ctx));
    expect(s.session.status).toBe("ended");
    expect(s.session.endedAt).toBeTruthy();
    expect(s.games.find((g) => g.id === gameId)).toMatchObject({ winner: null });
  });
});
