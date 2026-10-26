import { expect, it } from "vitest";
import { lastResults, pairCounts, pairKey } from "./history";
import type { PastGame } from "./types";

const g = (teamA: string[], teamB: string[], winner: "A" | "B" | null, endedAt: string, courtId = "c1"): PastGame =>
  ({ courtId, teamA, teamB, winner, endedAt });

it("counts partners and opponents across all games, including games without a winner", () => {
  const c = pairCounts([g(["a", "b"], ["c", "d"], "A", "1"), g(["a", "b"], ["c", "e"], null, "2")]);
  expect(c.partners.get(pairKey("b", "a"))).toBe(2);
  expect(c.opponents.get(pairKey("a", "c"))).toBe(2);
  expect(c.opponents.get(pairKey("a", "e"))).toBe(1);
  expect(c.partners.get(pairKey("a", "c"))).toBeUndefined();
});

it("last result comes from the latest game with a winner", () => {
  const r = lastResults([g(["a", "b"], ["c", "d"], "A", "1"), g(["a", "c"], ["e", "f"], "B", "2"), g(["a", "x"], ["y", "z"], null, "3")]);
  expect(r.get("a")).toBe("lost");
  expect(r.get("b")).toBe("won");
  expect(r.get("x")).toBeUndefined();
});
