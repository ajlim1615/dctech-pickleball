import { describe, it, expect } from "vitest";
import { computeSessionLeaderboard } from "./utils/sessionLeaderboard";

describe("Session Leaderboard Engine", () => {
  const mockCheckins = [
    { id: "c1", player_id: "p1", player: { id: "p1", full_name: "Alex Pro", display_name: "Alex", skill_rating: 4.5 } },
    { id: "c2", player_id: "p2", player: { id: "p2", full_name: "Ben Ace", display_name: "Ben", skill_rating: 4.0 } },
    { id: "c3", player_id: "p3", player: { id: "p3", full_name: "Clara Champ", display_name: "Clara", skill_rating: 3.5 } },
    { id: "c4", player_id: "p4", player: { id: "p4", full_name: "Dan Novice", display_name: "Dan", skill_rating: 3.0 } },
  ];

  const mockMatches = [
    {
      id: "m1",
      session_id: "s1",
      status: "completed",
      team_a_score: 11,
      team_b_score: 8,
      winning_team: "team_a",
      players: [
        { team: "team_a", player: { id: "p1", full_name: "Alex Pro", skill_rating: 4.5 } },
        { team: "team_a", player: { id: "p4", full_name: "Dan Novice", skill_rating: 3.0 } },
        { team: "team_b", player: { id: "p2", full_name: "Ben Ace", skill_rating: 4.0 } },
        { team: "team_b", player: { id: "p3", full_name: "Clara Champ", skill_rating: 3.5 } },
      ],
    },
    {
      id: "m2",
      session_id: "s1",
      status: "completed",
      team_a_score: 11,
      team_b_score: 9,
      winning_team: "team_a",
      players: [
        { team: "team_a", player: { id: "p1", full_name: "Alex Pro", skill_rating: 4.5 } },
        { team: "team_a", player: { id: "p3", full_name: "Clara Champ", skill_rating: 3.5 } },
        { team: "team_b", player: { id: "p2", full_name: "Ben Ace", skill_rating: 4.0 } },
        { team: "team_b", player: { id: "p4", full_name: "Dan Novice", skill_rating: 3.0 } },
      ],
    },
  ];

  it("should calculate session standings accurately based on matches and checkins", () => {
    const leaderboard = computeSessionLeaderboard(mockMatches, mockCheckins);

    expect(leaderboard.length).toBe(4);

    // Alex Pro: 2 matches played, 2 wins (100% win rate)
    const alex = leaderboard.find((p) => p.id === "p1");
    expect(alex).toBeDefined();
    expect(alex?.rank).toBe(1);
    expect(alex?.games_played).toBe(2);
    expect(alex?.games_won).toBe(2);
    expect(alex?.win_rate).toBe(100);
    expect(alex?.points_scored).toBe(22);
    expect(alex?.points_conceded).toBe(17);
    expect(alex?.point_diff).toBe(5);

    // Clara Champ: 2 matches, 1 win, 1 loss (50% win rate)
    const clara = leaderboard.find((p) => p.id === "p3");
    expect(clara?.games_played).toBe(2);
    expect(clara?.games_won).toBe(1);
    expect(clara?.win_rate).toBe(50);

    // Ben Ace: 2 matches, 0 wins (0% win rate)
    const ben = leaderboard.find((p) => p.id === "p2");
    expect(ben?.games_played).toBe(2);
    expect(ben?.games_won).toBe(0);
    expect(ben?.win_rate).toBe(0);
  });
});
