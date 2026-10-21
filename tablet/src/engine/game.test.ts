import { describe, it, expect } from "vitest";
import { checkIn, suggestGame, startGame, finishGame, correctResult, refillCourts } from "./game";
import { sessionLeaderboard } from "./leaderboard";
import { makeCtx, makeState } from "./fixtures";
import { isEngineError, type SessionState } from "./types";

function ok(value: SessionState | { error: string }): SessionState {
  if (isEngineError(value)) throw new Error(value.error);
  return value;
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

function waitingIds(state: SessionState) {
  return state.queue
    .filter((q) => q.status === "waiting")
    .sort((a, b) => a.position - b.position)
    .map((q) => q.playerId);
}

function activeGame(state: SessionState, courtId: string) {
  return state.games.find((g) => g.courtId === courtId && !g.endedAt);
}

describe("game cycle", () => {
  it("checkIn twice does not duplicate", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(), ["p1", "p2"], ctx);
    s = checkIn(s, ["p2", "p3"], ctx);
    expect(waitingIds(s)).toEqual(["p1", "p2", "p3"]);
  });

  it("suggestGame with 3 waiting returns waitingFor 1", () => {
    const s = checkIn(makeState(), ids(3), makeCtx());
    expect(suggestGame(s, "c1")).toEqual({ waitingFor: 1 });
  });

  it("startGame refuses a player already playing", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(), ids(8), ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    const again = startGame(s, "c2", { teamA: ["p1", "p5"], teamB: ["p6", "p7"] }, ctx);
    expect(isEngineError(again)).toBe(true);
  });

  it("finishGame win-by-2 rejects 11-10", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(), ids(4), ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    const game = activeGame(s, "c1")!;
    expect(isEngineError(finishGame(s, game.id, { scoreA: 11, scoreB: 10 }, ctx))).toBe(true);
  });

  it("finishGame first-to-11 accepts 11-10", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, { winBy2: false }), ids(4), ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    const game = activeGame(s, "c1")!;
    s = ok(finishGame(s, game.id, { scoreA: 11, scoreB: 10 }, ctx));
    expect(s.games.find((g) => g.id === game.id)).toMatchObject({ winner: "A", scoreA: 11, scoreB: 10 });
  });

  it("finishGame with trackScores off stores 1-0", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, { trackScores: false }), ids(4), ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    const game = activeGame(s, "c1")!;
    s = ok(finishGame(s, game.id, { winner: "B" }, ctx));
    expect(s.games.find((g) => g.id === game.id)).toMatchObject({ winner: "B", scoreA: 0, scoreB: 1 });
  });

  it("finishGame re-queues the four at the back and refills the court", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, { courts: [{ id: "c1", name: "Court 1", closed: false }] }), ids(8), ctx);
    s = refillCourts(s, ctx);
    const first = activeGame(s, "c1")!;
    expect([...first.teamA, ...first.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);
    s = ok(finishGame(s, first.id, { scoreA: 11, scoreB: 5 }, ctx));
    const next = activeGame(s, "c1")!;
    expect([...next.teamA, ...next.teamB].sort()).toEqual(["p5", "p6", "p7", "p8"]);
    expect(waitingIds(s).sort()).toEqual(["p1", "p2", "p3", "p4"]);
    expect(s.queue.find((q) => q.playerId === "p1")!.gamesPlayed).toBe(1);
  });

  it("finishGame winners_stay keeps both winners on the court", () => {
    const ctx = makeCtx();
    let s = checkIn(
      makeState(9, { matchingStyle: "winners_stay", courts: [{ id: "c1", name: "Court 1", closed: false }] }),
      ids(8),
      ctx
    );
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    s = ok(finishGame(s, activeGame(s, "c1")!.id, { scoreA: 11, scoreB: 3 }, ctx));
    const next = activeGame(s, "c1")!;
    const players = [...next.teamA, ...next.teamB];
    expect(players).toContain("p1");
    expect(players).toContain("p2");
    expect(next.teamA).not.toEqual(expect.arrayContaining(["p1", "p2"]));
  });

  it("winners_losers splits the last winners when they come back up together", () => {
    const ctx = makeCtx();
    const court = { courts: [{ id: "c1", name: "Court 1", closed: false }] };
    let s = checkIn(makeState(9, { matchingStyle: "winners_losers", ...court }), ids(4), ctx);
    // p1 (3.0) + p4 (4.5): balanced alone would keep the strongest and weakest together.
    s = ok(startGame(s, "c1", { teamA: ["p1", "p4"], teamB: ["p2", "p3"] }, ctx));
    s = ok(finishGame(s, activeGameOnCourt(s, "c1")!.id, { scoreA: 11, scoreB: 2 }, ctx));
    const next = activeGameOnCourt(s, "c1")!;
    expect(next.teamA.filter((id) => id === "p1" || id === "p4")).toHaveLength(1);
  });

  it("refillCourts never puts one player on two courts", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(), ids(8), ctx);
    s = refillCourts(s, ctx);
    const onCourt = s.games.filter((g) => !g.endedAt).flatMap((g) => [...g.teamA, ...g.teamB]);
    expect(onCourt).toHaveLength(8);
    expect(new Set(onCourt).size).toBe(8);
  });

  it("correctResult flips the winner without changing queue or courts", () => {
    const ctx = makeCtx();
    let s = checkIn(
      makeState(9, { matchingStyle: "winners_stay", courts: [{ id: "c1", name: "Court 1", closed: false }] }),
      ids(8),
      ctx
    );
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    const finished = activeGame(s, "c1")!.id;
    s = ok(finishGame(s, finished, { scoreA: 11, scoreB: 3 }, ctx));
    const before = { queue: s.queue, active: s.games.filter((g) => !g.endedAt) };
    const after = ok(correctResult(s, finished, { scoreA: 3, scoreB: 11 }, ctx));
    expect(after.queue).toEqual(before.queue);
    expect(after.games.filter((g) => !g.endedAt)).toEqual(before.active);
    expect(after.games.find((g) => g.id === finished)).toMatchObject({ winner: "B", scoreA: 3, scoreB: 11 });
    expect(after.games.find((g) => g.id === finished)!.correctedAt).toBeTruthy();
  });

  it("sessionLeaderboard counts wins and losses after a correction", () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9, { courts: [{ id: "c1", name: "Court 1", closed: false }] }), ids(4), ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    const gameId = activeGame(s, "c1")!.id;
    s = ok(finishGame(s, gameId, { scoreA: 11, scoreB: 7 }, ctx));
    s = ok(correctResult(s, gameId, { scoreA: 7, scoreB: 11 }, ctx));
    const board = sessionLeaderboard(s);
    expect(board.find((r) => r.id === "p3")).toMatchObject({ games_won: 1, games_lost: 0, points_scored: 11 });
    expect(board.find((r) => r.id === "p1")).toMatchObject({ games_won: 0, games_lost: 1 });
    expect(board.find((r) => r.id === "p1")!.display_name).toBe("Player 1");
  });
});
