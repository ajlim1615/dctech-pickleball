import { describe, it, expect } from "vitest";
import {
  formatMatchScore,
  getWinner,
  isResultOnlyScore,
  quickWinScore,
  type ScoringRule,
} from "@/features/matches/utils/scoring";

const winBy2: ScoringRule = { targetPoints: 11, winByTwo: true };
const capped: ScoringRule = { targetPoints: 11, winByTwo: false };

describe("getWinner", () => {
  it("requires a 2-point lead when win by 2 is on", () => {
    expect(getWinner(11, 10, winBy2)).toBeNull();
    expect(getWinner(12, 10, winBy2)).toBe("A");
    expect(getWinner(9, 11, winBy2)).toBe("B");
  });

  it("ends at exactly the target when win by 2 is off", () => {
    expect(getWinner(11, 10, capped)).toBe("A");
    expect(getWinner(10, 10, capped)).toBeNull();
    expect(getWinner(12, 10, capped)).toBeNull();
  });
});

describe("quickWinScore", () => {
  it("goes past the target at deuce when win by 2 is on", () => {
    expect(quickWinScore("A", 10, 10, winBy2)).toEqual({ scoreA: 12, scoreB: 10 });
    expect(quickWinScore("B", 5, 9, winBy2)).toEqual({ scoreA: 5, scoreB: 11 });
    expect(quickWinScore("A", 10, 11, winBy2)).toEqual({ scoreA: 13, scoreB: 11 });
  });

  it("stops at the target when win by 2 is off", () => {
    expect(quickWinScore("A", 10, 10, capped)).toEqual({ scoreA: 11, scoreB: 10 });
    expect(quickWinScore("B", 3, 7, capped)).toEqual({ scoreA: 3, scoreB: 11 });
  });

  it("always produces a finished game", () => {
    for (const rule of [winBy2, capped, { targetPoints: 6, winByTwo: false }]) {
      for (let a = 0; a < rule.targetPoints; a++) {
        for (let b = 0; b < rule.targetPoints; b++) {
          const r = quickWinScore("A", a, b, rule);
          expect(getWinner(r.scoreA, r.scoreB, rule)).toBe("A");
        }
      }
    }
  });
});

describe("win/loss-only sessions", () => {
  const resultOnly: ScoringRule = { targetPoints: 11, winByTwo: true, trackScores: false };

  it("accepts only a 1-0 result", () => {
    expect(getWinner(1, 0, resultOnly)).toBe("A");
    expect(getWinner(0, 1, resultOnly)).toBe("B");
    expect(getWinner(11, 9, resultOnly)).toBeNull();
  });

  it("records a quick win as 1-0", () => {
    expect(quickWinScore("B", 7, 3, resultOnly)).toEqual({ scoreA: 0, scoreB: 1 });
  });

  it("shows W/L instead of a 1-0 score", () => {
    expect(formatMatchScore(1, 0)).toBe("W - L");
    expect(formatMatchScore(0, 1)).toBe("L - W");
    expect(formatMatchScore(11, 9)).toBe("11 - 9");
    expect(isResultOnlyScore(6, 4)).toBe(false);
  });
});
