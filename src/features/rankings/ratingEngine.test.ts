import { describe, it, expect } from "vitest";
import {
  calculateRatingChanges,
  expectedScore,
  RATING_MAX,
  RATING_MIN,
  type RatedPlayer,
} from "@/features/rankings/utils/ratingEngine";

const p = (id: string, rating: number, gamesPlayed = 20): RatedPlayer => ({ id, rating, gamesPlayed });

describe("expectedScore", () => {
  it("is even for equal teams and favours the stronger team", () => {
    expect(expectedScore(3.5, 3.5)).toBeCloseTo(0.5);
    expect(expectedScore(4.0, 3.5)).toBeCloseTo(0.76, 2);
  });
});

describe("calculateRatingChanges", () => {
  it("moves winners up and losers down by the same amount", () => {
    const changes = calculateRatingChanges([p("a1", 3.5), p("a2", 3.5)], [p("b1", 3.5), p("b2", 3.5)], 11, 9, 11);
    const byId = Object.fromEntries(changes.map((c) => [c.playerId, c]));
    expect(byId.a1.change).toBeGreaterThan(0);
    expect(byId.b1.change).toBeLessThan(0);
    expect(byId.a1.change).toBeCloseTo(-byId.b1.change, 2);
    expect(byId.a1.newRating).toBeCloseTo(byId.a1.oldRating + byId.a1.change, 2);
  });

  it("rewards an upset more than an expected win", () => {
    const upset = calculateRatingChanges([p("a1", 3.0), p("a2", 3.0)], [p("b1", 4.0), p("b2", 4.0)], 11, 9, 11);
    const expected = calculateRatingChanges([p("a1", 4.0), p("a2", 4.0)], [p("b1", 3.0), p("b2", 3.0)], 11, 9, 11);
    expect(upset[0].change).toBeGreaterThan(expected[0].change);
  });

  it("gives a bigger change for a blowout, and no margin bonus for win/loss-only games", () => {
    const close = calculateRatingChanges([p("a", 3.5)], [p("b", 3.5)], 12, 10, 11)[0].change;
    const blowout = calculateRatingChanges([p("a", 3.5)], [p("b", 3.5)], 11, 0, 11)[0].change;
    const resultOnly = calculateRatingChanges([p("a", 3.5)], [p("b", 3.5)], 1, 0, 11)[0].change;
    expect(blowout).toBeGreaterThan(close);
    expect(resultOnly).toBeLessThanOrEqual(close);
    expect(resultOnly).toBeGreaterThan(0);
  });

  it("moves new players faster than established ones", () => {
    const changes = calculateRatingChanges([p("new", 3.0, 2), p("vet", 3.0, 50)], [p("b1", 3.0), p("b2", 3.0)], 11, 5, 11);
    expect(changes[0].change).toBeGreaterThan(changes[1].change);
  });

  it("keeps ratings inside the scale", () => {
    const top = calculateRatingChanges([p("a", RATING_MAX, 0)], [p("b", RATING_MAX, 0)], 11, 0, 11)[0];
    const bottom = calculateRatingChanges([p("a", RATING_MIN, 0)], [p("b", RATING_MIN, 0)], 0, 11, 11)[0];
    expect(top.newRating).toBe(RATING_MAX);
    expect(bottom.newRating).toBe(RATING_MIN);
  });

  it("returns nothing for an empty team or a tie", () => {
    expect(calculateRatingChanges([], [p("b", 3)], 11, 5, 11)).toEqual([]);
    expect(calculateRatingChanges([p("a", 3)], [p("b", 3)], 5, 5, 11)).toEqual([]);
  });
});
