import { describe, it, expect } from "vitest";
import { shareRankings } from "./shareRankings";
import { makeState } from "../engine/fixtures";
import type { DeskGame, SessionState, Team } from "../engine/types";

let n = 0;
function game(teamA: string[], teamB: string[], winner: Team, scoreA = 11, scoreB = 5): DeskGame {
  n += 1;
  const at = new Date(Date.UTC(2026, 9, 22, 18, n)).toISOString();
  return { id: `g${n}`, sessionId: "s1", courtId: "c1", teamA, teamB, winner, scoreA, scoreB, startedAt: at, endedAt: at };
}

function withGames(games: DeskGame[], trackScores = true): SessionState {
  const state = makeState(12, { trackScores });
  return { ...state, games };
}

describe("shareRankings", () => {
  it("ranks players with 3+ games and lists the rest as provisional", () => {
    // p1 and p2 play three games; p3–p6 play fewer.
    const s = withGames([
      game(["p1", "p2"], ["p3", "p4"], "A"),
      game(["p1", "p2"], ["p5", "p6"], "A"),
      game(["p1", "p2"], ["p3", "p5"], "B"),
    ]);
    const result = shareRankings(s);
    expect(result.ranked.map((r) => r.id).sort()).toEqual(["p1", "p2"]);
    expect(result.ranked.every((r) => r.won === 2 && r.lost === 1)).toBe(true);
    expect(result.provisional.map((r) => r.id)).toEqual(["p3", "p5", "p4", "p6"]);
    expect(result.players).toBe(6);
    expect(result.games).toBe(3);
  });

  it("orders by wins, then point difference, then name", () => {
    const s = withGames([
      game(["p1", "p2"], ["p3", "p4"], "A", 11, 9),
      game(["p3", "p4"], ["p1", "p2"], "A", 11, 2),
      game(["p1", "p3"], ["p2", "p4"], "A", 11, 3),
    ]);
    // Wins: p1 2, p3 2, p2 1, p4 1. Diff: p3 (−2 +9 +8 = 15) beats p1 (2 −9 +8 = 1).
    expect(shareRankings(s).ranked.map((r) => r.id)).toEqual(["p3", "p1", "p4", "p2"]);
  });

  it("ignores point difference when scores aren't tracked", () => {
    const s = withGames(
      [
        game(["p2", "p1"], ["p3", "p4"], "A", 1, 0),
        game(["p2", "p1"], ["p3", "p4"], "B", 0, 1),
        game(["p2", "p1"], ["p3", "p4"], "A", 1, 0),
      ],
      false
    );
    expect(shareRankings(s).ranked.map((r) => r.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("caps the card at 12 rows and counts the rest", () => {
    const players = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    const games: DeskGame[] = [];
    for (let i = 0; i < 12; i += 4) games.push(game(players.slice(i, i + 2), players.slice(i + 2, i + 4), "A"));
    const s = withGames(games);
    const big = { ...s, players: { ...s.players, extra: { ...s.players.p1, id: "extra", name: "Extra" } } };
    big.games = [...games, game(["extra", "p1"], ["p2", "p3"], "A")];
    const result = shareRankings(big, { maxRows: 12 });
    expect(result.ranked.length + result.provisional.length).toBe(12);
    expect(result.more).toBe(1);
  });

  it("is empty before any game finishes", () => {
    expect(shareRankings(makeState())).toEqual({ players: 0, games: 0, ranked: [], provisional: [], more: 0 });
  });
});
