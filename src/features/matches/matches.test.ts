import { describe, it, expect } from "vitest";

describe("Match Scoring Logic", () => {
  function getMatchOutcome(scoreA: number, scoreB: number) {
    const isGameOver = (scoreA >= 11 && scoreA - scoreB >= 2) || (scoreB >= 11 && scoreB - scoreA >= 2);
    const winner = scoreA > scoreB ? "team_a" : scoreB > scoreA ? "team_b" : "tie";
    return { isGameOver, winner };
  }

  it("determines game completion with standard pickleball win-by-2 rule", () => {
    expect(getMatchOutcome(11, 9)).toEqual({ isGameOver: true, winner: "team_a" });
    expect(getMatchOutcome(10, 10)).toEqual({ isGameOver: false, winner: "tie" });
    expect(getMatchOutcome(11, 10)).toEqual({ isGameOver: false, winner: "team_a" });
    expect(getMatchOutcome(12, 10)).toEqual({ isGameOver: true, winner: "team_a" });
    expect(getMatchOutcome(6, 11)).toEqual({ isGameOver: true, winner: "team_b" });
  });
});
