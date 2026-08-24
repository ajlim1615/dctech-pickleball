import { describe, it, expect } from "vitest";
import { createMatchupFromPod } from "./utils/matchingEngine";
import type { Profile } from "@/types";

const mockPlayers: Profile[] = [
  { id: "p1", email: "p1@dctechmicro.com", full_name: "Pro Alex", display_name: "Alex", avatar_url: null, role: "player", skill_rating: 4.5, games_played: 10, games_won: 8, is_active: true, created_at: "", updated_at: "" },
  { id: "p2", email: "p2@dctechmicro.com", full_name: "Advanced Ben", display_name: "Ben", avatar_url: null, role: "player", skill_rating: 4.0, games_played: 10, games_won: 6, is_active: true, created_at: "", updated_at: "" },
  { id: "p3", email: "p3@dctechmicro.com", full_name: "Intermediate Clara", display_name: "Clara", avatar_url: null, role: "player", skill_rating: 3.5, games_played: 10, games_won: 5, is_active: true, created_at: "", updated_at: "" },
  { id: "p4", email: "p4@dctechmicro.com", full_name: "Novice Dan", display_name: "Dan", avatar_url: null, role: "player", skill_rating: 3.0, games_played: 10, games_won: 2, is_active: true, created_at: "", updated_at: "" },
];

describe("Pickleball Matching Engine", () => {
  it("should create a balanced 2v2 matchup pairing (Highest+Lowest) vs (Middle Two)", () => {
    const matchup = createMatchupFromPod(mockPlayers, "balanced");

    // Team A should have P1 (4.5) + P4 (3.0) -> Avg = 3.75
    expect(matchup.teamA.map((p) => p.id)).toEqual(["p1", "p4"]);
    expect(matchup.teamARatingAvg).toBe(3.75);

    // Team B should have P2 (4.0) + P3 (3.5) -> Avg = 3.75
    expect(matchup.teamB.map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(matchup.teamBRatingAvg).toBe(3.75);

    // Rating delta should be 0.00 (100% balance)
    expect(matchup.ratingDelta).toBe(0);
    expect(matchup.balanceScorePercent).toBe(100);
  });

  it("should create a skill separated matchup pairing (Top 2) vs (Bottom 2)", () => {
    const matchup = createMatchupFromPod(mockPlayers, "skill_separated");

    // Team A should have P1 (4.5) + P2 (4.0) -> Top tier
    expect(matchup.teamA.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(matchup.teamARatingAvg).toBe(4.25);

    // Team B should have P3 (3.5) + P4 (3.0) -> Lower tier
    expect(matchup.teamB.map((p) => p.id)).toEqual(["p3", "p4"]);
    expect(matchup.teamBRatingAvg).toBe(3.25);

    expect(matchup.ratingDelta).toBe(1.0);
  });

  it("should split previous winners with challengers in winners_losers mode", () => {
    const previousWinners = [mockPlayers[0], mockPlayers[1]]; // P1, P2 won previous match
    const matchup = createMatchupFromPod(mockPlayers, "winners_losers", previousWinners);

    // P1 on Team A with a challenger, P2 on Team B with a challenger
    expect(matchup.teamA[0].id).toBe("p1");
    expect(matchup.teamB[0].id).toBe("p2");
    expect(matchup.teamA.length).toBe(2);
    expect(matchup.teamB.length).toBe(2);
  });

  it("should fallback to balanced pairing when no previous winners exist in winners_losers mode", () => {
    const matchup = createMatchupFromPod(mockPlayers, "winners_losers", []);

    expect(matchup.teamA.map((p) => p.id)).toEqual(["p1", "p4"]);
    expect(matchup.teamB.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("should create a standard FIFO matchup pairing (P1+P2) vs (P3+P4)", () => {
    const matchup = createMatchupFromPod(mockPlayers, "fifo");

    expect(matchup.teamA.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(matchup.teamB.map((p) => p.id)).toEqual(["p3", "p4"]);
  });

  it("should shuffle all 4 players evenly into 2 teams in social_mixer mode", () => {
    const matchup = createMatchupFromPod(mockPlayers, "social_mixer");

    expect(matchup.teamA.length).toBe(2);
    expect(matchup.teamB.length).toBe(2);

    const allIds = [...matchup.teamA.map((p) => p.id), ...matchup.teamB.map((p) => p.id)];
    expect(allIds.sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("should handle partial pods of 2 players (singles)", () => {
    const twoPlayers = [mockPlayers[0], mockPlayers[1]];
    const matchup = createMatchupFromPod(twoPlayers, "balanced");

    expect(matchup.teamA.length).toBe(1);
    expect(matchup.teamB.length).toBe(1);
    expect(matchup.teamA[0].id).toBe("p1");
    expect(matchup.teamB[0].id).toBe("p2");
  });

  it("should handle empty player list gracefully", () => {
    const matchup = createMatchupFromPod([], "balanced");

    expect(matchup.teamA).toEqual([]);
    expect(matchup.teamB).toEqual([]);
    expect(matchup.balanceScorePercent).toBe(100);
  });
});
