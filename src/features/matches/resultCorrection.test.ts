import { describe, it, expect } from "vitest";
import { gamesPlayedBefore, planResultCorrection } from "@/features/matches/utils/resultCorrection";
import { calculateRatingChanges, type RatedPlayer } from "@/features/rankings/utils/ratingEngine";
import type { ScoringRule } from "@/features/matches/utils/scoring";

const rule: ScoringRule = { targetPoints: 11, winByTwo: true };
const p = (id: string): RatedPlayer => ({ id, rating: 3.5, gamesPlayed: 20 });
const teamA = [p("a1"), p("a2")];
const teamB = [p("b1"), p("b2")];
const stored = calculateRatingChanges(teamA, teamB, 11, 9, 11);
const history = stored.map((c) => ({ playerId: c.playerId, oldRating: c.oldRating, change: c.change }));

const base = { rule, isRanked: true, oldScore: { a: 11, b: 9 }, teamA, teamB, history };

describe("planResultCorrection", () => {
  it("rejects an unfinished score", () => {
    const plan = planResultCorrection({ ...base, newScore: { a: 11, b: 10 } });
    expect(plan.error).toContain("is not a finished game");
  });

  it("casual game: no rating updates or wins moves", () => {
    const plan = planResultCorrection({ ...base, isRanked: false, newScore: { a: 9, b: 11 } });
    expect(plan.error).toBeUndefined();
    expect(plan.winningTeam).toBe("team_b");
    expect(plan.ratingUpdates).toEqual([]);
    expect(plan.winsMoves).toEqual([]);
  });

  it("ranked, same winner: rating updates, no wins moves", () => {
    const plan = planResultCorrection({ ...base, newScore: { a: 11, b: 2 } });
    expect(plan.winningTeam).toBe("team_a");
    expect(plan.ratingUpdates).toHaveLength(4);
    expect(plan.ratingUpdates.find((u) => u.playerId === "a1")!.delta).toBeGreaterThan(0);
    expect(plan.winsMoves).toEqual([]);
  });

  it("ranked, winner flipped: wins move from old winners to new", () => {
    const plan = planResultCorrection({ ...base, newScore: { a: 9, b: 11 } });
    expect(plan.winsMoves).toHaveLength(4);
    expect(plan.winsMoves.filter((m) => m.by === -1).map((m) => m.playerId).sort()).toEqual(["a1", "a2"]);
    expect(plan.winsMoves.filter((m) => m.by === 1).map((m) => m.playerId).sort()).toEqual(["b1", "b2"]);
  });

  it("ranked with no history rows: fixes nothing rating-wise", () => {
    const plan = planResultCorrection({ ...base, history: [], newScore: { a: 9, b: 11 } });
    expect(plan.ratingUpdates).toEqual([]);
    expect(plan.winningTeam).toBe("team_b");
  });

  it("same score as stored: all deltas zero", () => {
    const plan = planResultCorrection({ ...base, newScore: { a: 11, b: 9 } });
    expect(plan.ratingUpdates.every((u) => u.delta === 0)).toBe(true);
    expect(plan.winsMoves).toEqual([]);
  });
});

describe("planResultCorrection — unchanged and provisional players", () => {
  it("flags a correction to the stored score as unchanged", () => {
    const plan = planResultCorrection({ ...base, newScore: { a: 11, b: 9 } });
    expect(plan.unchanged).toBe(true);
  });

  it("uses the player's game count from when the game was played", () => {
    // Saved while a1 was provisional (2 games), so their change was 1.5x.
    const then = [{ id: "a1", rating: 3.5, gamesPlayed: 2 }, p("a2")];
    const savedChanges = calculateRatingChanges(then, teamB, 11, 9, 11);
    const savedHistory = savedChanges.map((c) => ({ playerId: c.playerId, oldRating: c.oldRating, change: c.change }));
    // Correcting the margin only, with a1's game count from back then, must not
    // shrink their change to the established-player rate.
    const plan = planResultCorrection({ ...base, teamA: then, history: savedHistory, newScore: { a: 11, b: 8 } });
    const a1 = plan.ratingUpdates.find((u) => u.playerId === "a1")!;
    const a2 = plan.ratingUpdates.find((u) => u.playerId === "a2")!;
    expect(a1.newChange).toBeGreaterThan(a2.newChange);
  });
});

describe("gamesPlayedBefore", () => {
  it("counts games played before this one", () => {
    expect(gamesPlayedBefore(12, 3)).toBe(8);
    expect(gamesPlayedBefore(0, 0)).toBe(0);
  });
});
