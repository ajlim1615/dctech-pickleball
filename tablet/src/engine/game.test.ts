import { describe, it, expect } from "vitest";
import { checkIn, suggestGame, startGame, finishGame, correctResult, refillCourts, activeGameOnCourt, suggestAll } from "./game";
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

  it("suggestAll gives each free court different players", () => {
    const s = checkIn(makeState(), ids(9), makeCtx());
    const suggestions = suggestAll(s);
    const c1 = suggestions.c1;
    const c2 = suggestions.c2;
    if (!("teamA" in c1) || !("teamA" in c2)) throw new Error("expected two suggestions");
    const all = [...c1.teamA, ...c1.teamB, ...c2.teamA, ...c2.teamB];
    expect(new Set(all).size).toBe(8);
  });

  it("suggestAll says how many more are needed once the line runs out", () => {
    const s = checkIn(makeState(), ids(6), makeCtx());
    expect(suggestAll(s).c2).toEqual({ waitingFor: 2 });
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

const withSkills = (s: SessionState, skills: number[]): SessionState => ({
  ...s,
  players: Object.fromEntries(Object.values(s.players).map((p, i) => [p.id, { ...p, skill: skills[i] ?? p.skill }])),
});
const oneCourt = { courts: [{ id: "c1", name: "Court 1", closed: false }] };

describe("matchmaking modes", () => {
  it("suggestGame uses session history to avoid repeat partners", () => {
    const ctx = makeCtx();
    let s = checkIn(withSkills(makeState(4, { matchingStyle: "social_mixer", ...oneCourt }), [3, 3, 3, 3]), ids(4), ctx);
    s = ok(startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx));
    s = ok(finishGame(s, activeGameOnCourt(s, "c1")!.id, { scoreA: 11, scoreB: 5 }, ctx));
    const next = activeGameOnCourt(s, "c1")!; // finishGame refills the court
    const team = next.teamA.includes("p1") ? next.teamA : next.teamB;
    expect(team).not.toContain("p2");
  });

  it("skill separated suggestion holds and force overrides", () => {
    const s = checkIn(withSkills(makeState(4, { matchingStyle: "skill_separated", ...oneCourt }), [2, 3, 4, 5]), ids(4), makeCtx());
    expect(suggestGame(s, "c1")).toEqual({ hold: "no_skill_match" });
    expect("teamA" in suggestGame(s, "c1", undefined, true)).toBe(true);
  });

  it("refillCourts leaves a held court empty", () => {
    const s = checkIn(withSkills(makeState(4, { matchingStyle: "skill_separated", ...oneCourt }), [2, 3, 4, 5]), ids(4), makeCtx());
    expect(activeGameOnCourt(refillCourts(s, makeCtx()), "c1")).toBeUndefined();
  });
});

describe("refillCourts with holds", () => {
  it("skips a held court and still fills a later one", () => {
    const courts = ["c1", "c2", "c3"].map((id, i) => ({ id, name: `Court ${i + 1}`, closed: false }));
    const base = checkIn(makeState(5, { matchingStyle: "king_queen", courts }), ids(5), makeCtx());
    const done = (id: string, courtId: string, teamA: string[], teamB: string[], endedAt: string) => ({
      id,
      sessionId: base.session.id,
      courtId,
      teamA,
      teamB,
      scoreA: 11,
      scoreB: 3,
      winner: "A" as const,
      startedAt: "2026-10-21T17:00:00.000Z",
      endedAt,
    });
    // k1+k2 (p1,p2) won on Court 1; a+b (p3,p4) won on Court 2. Court 3 is first in line to fill but has only p5 free.
    const s: SessionState = {
      ...base,
      games: [
        done("g1", "c1", ["p1", "p2"], ["x1", "x2"], "2026-10-21T18:00:00.000Z"),
        done("g2", "c2", ["p3", "p4"], ["x3", "x4"], "2026-10-21T18:01:00.000Z"),
      ],
    };
    expect(suggestGame(s, "c3")).toEqual({ waitingFor: 3 });
    const next = refillCourts(s, makeCtx(), "c3");
    expect(activeGameOnCourt(next, "c1")).toBeDefined();
    expect(activeGameOnCourt(next, "c3")).toBeUndefined();
  });
});
