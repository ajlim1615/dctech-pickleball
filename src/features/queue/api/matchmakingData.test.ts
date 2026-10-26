import { describe, expect, it } from "vitest";
import { holdMessage, pastGamesFromMatches } from "./matchmakingData";

describe("pastGamesFromMatches", () => {
  it("keeps completed games only, maps teams and winners, sorts by end time", () => {
    const rows = [
      { court_id: "c1", status: "completed", winning_team: "team_b" as const, ended_at: "2",
        players: [{ team: "team_a" as const, player_id: "a" }, { team: "team_a" as const, player_id: "b" }, { team: "team_b" as const, player_id: "c" }, { team: "team_b" as const, player_id: "d" }] },
      { court_id: "c2", status: "abandoned", winning_team: null, ended_at: "3", players: [] },
      { court_id: "c1", status: "completed", winning_team: "tie" as const, ended_at: "1",
        players: [{ team: "team_a" as const, player: { id: "a" } }, { team: "team_b" as const, player: { id: "c" } }] },
    ];
    expect(pastGamesFromMatches(rows)).toEqual([
      { courtId: "c1", teamA: ["a"], teamB: ["c"], winner: null, endedAt: "1" },
      { courtId: "c1", teamA: ["a", "b"], teamB: ["c", "d"], winner: "B", endedAt: "2" },
    ]);
  });
});

describe("holdMessage", () => {
  it("hold messages", () => {
    expect(holdMessage({ hold: "not_enough_players", needed: 1 }, 0.75)).toBe("Need 1 more waiting player to start a game.");
    expect(holdMessage({ hold: "not_enough_players", needed: 2 }, 0.75)).toBe("Need 2 more waiting players to start a game.");
    expect(holdMessage({ hold: "no_skill_match" }, 0.75)).toBe("No group of four within 0.75 rating of each other yet.");
  });
});
