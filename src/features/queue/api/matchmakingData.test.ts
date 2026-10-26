import { describe, expect, it } from "vitest";
import { holdMessage, pastGamesFromMatches, previewCourtId } from "./matchmakingData";

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
    expect(holdMessage({ hold: "not_enough_players", needed: 2 }, 0.75, 2)).toBe(
      "Need 2 more waiting players to start a game. (2 waiting players are saved for a court above.)"
    );
    expect(holdMessage({ hold: "not_enough_players", needed: 2 }, 0.75, 0)).toBe("Need 2 more waiting players to start a game.");
    expect(holdMessage({ hold: "no_skill_match" }, 0.75)).toBe("No group of four within 0.75 rating of each other yet.");
  });
});

describe("previewCourtId", () => {
  it("previews the first free open court", () => {
    const courts = [
      { id: "c2", status: "available", sort_order: 2, current_match_id: null },
      { id: "c1", status: "occupied", sort_order: 1, current_match_id: "m" },
      { id: "c0", status: "maintenance", sort_order: 0, current_match_id: null },
    ];
    expect(previewCourtId(courts)).toEqual({ court: "c2", courts: ["c1", "c2"] });
    expect(previewCourtId([courts[2]])).toBeNull();
  });

  it("falls back to the first open court when all are busy", () => {
    const courts = [
      { id: "b", status: "occupied", sort_order: 2, current_match_id: "m2" },
      { id: "a", status: "occupied", sort_order: 1, current_match_id: "m1" },
    ];
    expect(previewCourtId(courts)).toEqual({ court: "a", courts: ["a", "b"] });
  });
});
