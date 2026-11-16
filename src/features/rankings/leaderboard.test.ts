import { describe, it, expect } from "vitest";
import { buildLeaderboard, type PlayerTotals } from "@/features/rankings/utils/leaderboard";
import type { Profile } from "@/types";

const prof = (id: string, name: string, rating: number): Profile =>
  ({ id, full_name: name, display_name: name, skill_rating: rating }) as unknown as Profile;

const tot = (id: string, games: number, wins: number): PlayerTotals => ({
  player_id: id,
  games,
  wins,
  losses: games - wins,
  points_for: 0,
  points_against: 0,
});

describe("buildLeaderboard", () => {
  it("ranks by rating, not wins", () => {
    const res = buildLeaderboard(
      [prof("b", "B", 2.2), prof("a", "A", 2.4)],
      [tot("a", 5, 2), tot("b", 9, 7)],
    );
    expect(res.map((p) => p.id)).toEqual(["a", "b"]);
    expect(res.map((p) => p.rank)).toEqual([1, 2]);
  });

  it("needs 5 ranked games to be ranked", () => {
    const [p] = buildLeaderboard([prof("a", "A", 3)], [tot("a", 4, 4)]);
    expect(p.qualified).toBe(false);
    expect(p.rank).toBeNull();
    expect(p.gamesToQualify).toBe(1);
  });

  it("ties fall back to win rate, then wins, then name", () => {
    const res = buildLeaderboard(
      [prof("d", "dan", 3), prof("c", "Cat", 3), prof("b", "Bob", 3), prof("a", "Ann", 3)],
      [tot("a", 10, 5), tot("b", 5, 4), tot("c", 10, 8), tot("d", 10, 8)],
    );
    // c,d 80% (c,d 8 wins) ; b 80% with 4 wins ; a 50%
    expect(res.map((p) => p.id)).toEqual(["c", "d", "b", "a"]);
  });

  it("gives unique consecutive ranks even when tied", () => {
    const res = buildLeaderboard(
      [prof("a", "Same", 3), prof("b", "Same", 3)],
      [tot("a", 5, 3), tot("b", 5, 3)],
    );
    expect(res.map((p) => p.rank)).toEqual([1, 2]);
  });

  it("ignores games outside counted totals", () => {
    const [p] = buildLeaderboard([prof("a", "A", 2)], []);
    expect(p.games_played).toBe(0);
    expect(p.rank).toBeNull();
    expect(p.win_rate).toBe(0);
  });

  it("computes W-L and win rate", () => {
    const [p] = buildLeaderboard([prof("a", "A", 2)], [tot("a", 5, 3)]);
    expect(p.games_won).toBe(3);
    expect(p.games_lost).toBe(2);
    expect(p.win_rate).toBe(60);
    expect(p.qualified).toBe(true);
  });

  it("lists new players after ranked ones by games desc then name", () => {
    const res = buildLeaderboard(
      [prof("n1", "zed", 5), prof("n2", "amy", 5), prof("n3", "bob", 5), prof("r", "R", 1.5)],
      [tot("n1", 3, 1), tot("n2", 3, 1), tot("n3", 4, 1), tot("r", 5, 0)],
    );
    expect(res.map((p) => p.id)).toEqual(["r", "n3", "n2", "n1"]);
    expect(res.map((p) => p.rank)).toEqual([1, null, null, null]);
  });
});
