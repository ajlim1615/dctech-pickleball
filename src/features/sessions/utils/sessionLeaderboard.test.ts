import { describe, expect, it } from "vitest";
import { computeSessionLeaderboard } from "./sessionLeaderboard";

const p = (id: string, name: string, rating = 2) => ({ id, full_name: name, skill_rating: rating });
const game = (
  a: ReturnType<typeof p>[],
  b: ReturnType<typeof p>[],
  winner: "team_a" | "team_b",
  aScore?: number,
  bScore?: number
) => ({
  status: "completed",
  team_a_score: aScore ?? (winner === "team_a" ? 1 : 0),
  team_b_score: bScore ?? (winner === "team_b" ? 1 : 0),
  winning_team: winner,
  players: [...a.map((x) => ({ team: "team_a", player: x })), ...b.map((x) => ({ team: "team_b", player: x }))],
});

describe("computeSessionLeaderboard", () => {
  it("uses dense ranking when players are level on all tie-breakers", () => {
    const [ann, bob, cy, dee] = [p("a", "Ann"), p("b", "Bob"), p("c", "Cy"), p("d", "Dee")];
    const res = computeSessionLeaderboard([game([ann, bob], [cy, dee], "team_a")]);
    expect(res.map((r) => r.full_name)).toEqual(["Ann", "Bob", "Cy", "Dee"]);
    expect(res.map((r) => r.rank)).toEqual([1, 1, 2, 2]);
    expect(res.every((r) => r.tied)).toBe(true);
  });

  it("ranks higher win rate ahead of more games played when total wins are equal", () => {
    const [a, b, c, d, e, f] = [
      p("a", "Declard"),
      p("b", "Alexis"),
      p("c", "Cy"),
      p("d", "Dee"),
      p("e", "Eve"),
      p("f", "Fay"),
    ];
    // Declard: 3W / 3G (100% win rate), Alexis: 3W / 4G (75% win rate)
    const res = computeSessionLeaderboard([
      game([a, c], [d, e], "team_a", 11, 9),
      game([a, d], [c, f], "team_a", 11, 9),
      game([a, e], [d, f], "team_a", 11, 9),
      game([b, c], [d, e], "team_a", 11, 9),
      game([b, d], [c, f], "team_a", 11, 9),
      game([b, e], [d, f], "team_a", 11, 9),
      game([c, d], [b, f], "team_a", 11, 5), // Alexis loses 4th game
    ]);
    const declardIdx = res.findIndex((r) => r.id === "a");
    const alexisIdx = res.findIndex((r) => r.id === "b");
    expect(declardIdx).toBeLessThan(alexisIdx);
    expect(res[declardIdx].qualified).toBe(true);
    expect(res[alexisIdx].qualified).toBe(true);
  });

  it("breaks ties by schedule strength (opponents' win rate excluding games against you)", () => {
    const [a, b, strong1, strong2, weak1, weak2] = [
      p("a", "Erika"),
      p("b", "Junie"),
      p("s1", "Strong1"),
      p("s2", "Strong2"),
      p("w1", "Weak1"),
      p("w2", "Weak2"),
    ];
    // Both Erika and Junie win 1 game (11-9) against different pairs.
    // Strong1 & Strong2 win their other game; Weak1 & Weak2 lose their other game.
    const res = computeSessionLeaderboard([
      game([a, strong1], [strong2, weak1], "team_a", 11, 9),
      game([b, strong1], [weak1, weak2], "team_a", 11, 9),
      game([strong2, weak1], [a, b], "team_b", 9, 11),
      game([strong2, strong1], [weak1, weak2], "team_a", 11, 0),
    ]);
    const erika = res.find((r) => r.id === "a")!;
    const junie = res.find((r) => r.id === "b")!;
    expect(erika.games_won).toBe(junie.games_won);
    expect(erika.win_rate).toBe(junie.win_rate);
    expect(erika.point_diff).toBe(junie.point_diff);
    expect(erika.schedule_strength).toBeGreaterThan(junie.schedule_strength);
    expect(erika.rank).toBeLessThan(junie.rank);
  });

  it("places qualified players (3+ games) ahead of provisional players (<3 games)", () => {
    const [a, b, c, d, e] = [p("a", "Qual"), p("b", "Prov"), p("c", "C"), p("d", "D"), p("e", "E")];
    // Prov wins 2/2 (100%), Qual wins 1/3 (33%) -> Qual must still rank above Prov
    const res = computeSessionLeaderboard([
      game([b, c], [d, e], "team_a"),
      game([b, d], [c, e], "team_a"),
      game([a, c], [d, e], "team_a"),
      game([c, d], [a, e], "team_a"),
      game([c, e], [a, d], "team_a"),
    ]);
    const qual = res.find((r) => r.id === "a")!;
    const prov = res.find((r) => r.id === "b")!;
    expect(qual.qualified).toBe(true);
    expect(prov.qualified).toBe(false);
    expect(qual.rank).toBeLessThan(prov.rank);
  });
});
