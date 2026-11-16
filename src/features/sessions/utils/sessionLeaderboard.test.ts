import { describe, expect, it } from "vitest";
import { computeSessionLeaderboard } from "./sessionLeaderboard";

const p = (id: string, name: string, rating = 2) => ({ id, full_name: name, skill_rating: rating });
const game = (a: ReturnType<typeof p>[], b: ReturnType<typeof p>[], winner: "team_a" | "team_b") => ({
  status: "completed",
  team_a_score: winner === "team_a" ? 1 : 0,
  team_b_score: winner === "team_b" ? 1 : 0,
  winning_team: winner,
  players: [...a.map((x) => ({ team: "team_a", player: x })), ...b.map((x) => ({ team: "team_b", player: x }))],
});

describe("computeSessionLeaderboard", () => {
  it("gives players level on everything but name the same rank, then skips", () => {
    const [ann, bob, cy, dee] = [p("a", "Ann"), p("b", "Bob"), p("c", "Cy"), p("d", "Dee")];
    // Ann and Bob win together, Cy and Dee lose: two tied pairs.
    const res = computeSessionLeaderboard([game([ann, bob], [cy, dee], "team_a")]);
    expect(res.map((r) => r.full_name)).toEqual(["Ann", "Bob", "Cy", "Dee"]);
    expect(res.map((r) => r.rank)).toEqual([1, 1, 3, 3]);
    expect(res.every((r) => r.tied)).toBe(true);
  });

  it("separates players by rating when results are level", () => {
    const res = computeSessionLeaderboard([
      game([p("a", "Ann", 2.4), p("b", "Bob", 2.0)], [p("c", "Cy"), p("d", "Dee")], "team_a"),
    ]);
    expect(res.slice(0, 2).map((r) => [r.full_name, r.rank, r.tied])).toEqual([
      ["Ann", 1, false],
      ["Bob", 2, false],
    ]);
  });
});
