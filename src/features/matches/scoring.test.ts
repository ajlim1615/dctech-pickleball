import { describe, it, expect } from "vitest";
import { getWinner, quickWinScore, type ScoringRule } from "@/features/matches/utils/scoring";

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
