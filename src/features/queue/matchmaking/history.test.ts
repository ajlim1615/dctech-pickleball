import { expect, it } from "vitest";
import { gamesAheadByPlayer, gamesPlayedCounts, lastResults, pairCounts, pairKey } from "./history";
import type { LineEntry, PastGame } from "./types";

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

const entry = (playerId: string, arrivedAt?: string | null): LineEntry => ({
  playerId,
  rating: 3,
  arrivedAt,
});

it("counts completed games per player across both teams", () => {
  expect(gamesPlayedCounts([]).size).toBe(0);
  const counts = gamesPlayedCounts([
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "c"], ["e", "f"], "B", "2026-11-18T12:20:00Z"),
  ]);
  expect(counts.get("a")).toBe(2);
  expect(counts.get("b")).toBe(1);
  expect(counts.get("c")).toBe(2);
  expect(counts.get("e")).toBe(1);
  expect(counts.get("z")).toBeUndefined();
});

it("computes gamesAhead for equal arrival times with 1-game and 2-game gaps", () => {
  const arrived = "2026-11-18T12:00:00Z";
  const history = [
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "b"], ["x", "y"], "A", "2026-11-18T12:20:00Z"),
    g(["a", "x"], ["y", "z"], "A", "2026-11-18T12:30:00Z"),
  ];
  // a: 3/3 = 1.0, c: 1/3 = 0.333, e: 0/3 = 0 -> avgShare = (1 + 1/3 + 0)/3 = 4/9
  // expected = 4/3 = 1.333 -> a: +1.667 clamped to +1.5, c: -0.333, e: -1.333
  const ahead = gamesAheadByPlayer(
    [entry("a", arrived), entry("c", arrived), entry("e", arrived)],
    history
  );
  expect(ahead.get("a")).toBe(1.5);
  expect(ahead.get("c")).toBeCloseTo(-1 / 3, 5);
  expect(ahead.get("e")).toBeCloseTo(-4 / 3, 5);
});

it("keeps brand-new late arrivals with 0 eligible games neutral (0) and excluded from avgShare", () => {
  const early = "2026-11-18T12:00:00Z";
  const late = "2026-11-18T12:45:00Z";
  const history = [
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "b"], ["c", "d"], "A", "2026-11-18T12:25:00Z"),
  ];
  const ahead = gamesAheadByPlayer(
    [entry("a", early), entry("c", early), entry("late", late)],
    history
  );
  expect(ahead.get("late")).toBe(0);
  // a and c both played 2/2 so both should be 0 (late didn't drag avgShare down)
  expect(ahead.get("a")).toBeCloseTo(0, 5);
  expect(ahead.get("c")).toBeCloseTo(0, 5);
});

it("evaluates late arrivals fairly once eligible games have finished after they arrived", () => {
  const early = "2026-11-18T12:00:00Z";
  const mid = "2026-11-18T12:25:00Z";
  const history = [
    g(["a", "x"], ["y", "z"], "A", "2026-11-18T12:10:00Z"),
    g(["a", "x"], ["y", "z"], "A", "2026-11-18T12:20:00Z"),
    g(["a", "late"], ["y", "z"], "A", "2026-11-18T12:35:00Z"),
    g(["x", "y"], ["z", "w"], "A", "2026-11-18T12:45:00Z"),
  ];
  // a: 3/4 = 0.75, late: 1/2 = 0.5 -> avgShare = 0.625
  // a: 3 - 2.5 = +0.5, late: 1 - 1.25 = -0.25
  const ahead = gamesAheadByPlayer([entry("a", early), entry("late", mid)], history);
  expect(ahead.get("a")).toBeCloseTo(0.5, 5);
  expect(ahead.get("late")).toBeCloseTo(-0.25, 5);
});

it("recovers original arrival when checkin_time was overwritten after re-adding a player", () => {
  // Player 'readded' played at 12:10 & 12:20, then was re-added with checkin_time = 12:45
  const history = [
    g(["readded", "a"], ["c", "d"], "A", "2026-11-18T12:10:00+00:00"),
    g(["readded", "a"], ["c", "d"], "A", "2026-11-18T12:20:00.000Z"),
    g(["a", "c"], ["d", "e"], "A", "2026-11-18T12:30:00Z"),
  ];
  const ahead = gamesAheadByPlayer(
    [entry("readded", "2026-11-18T12:45:00Z"), entry("a", "2026-11-18T12:00:00Z")],
    history
  );
  // readded effectiveArrivedAt = 12:10 -> eligible = 3, played = 2 (share = 2/3)
  // a effectiveArrivedAt = 12:00 -> eligible = 3, played = 3 (share = 1)
  // avgShare = 5/6 -> readded = 2 - 2.5 = -0.5, a = 3 - 2.5 = +0.5
  expect(ahead.get("readded")).toBeCloseTo(-0.5, 5);
  expect(ahead.get("a")).toBeCloseTo(0.5, 5);
});

it("clamps extreme surplus and deficit to [-1.5, +1.5]", () => {
  const arrived = "2026-11-18T12:00:00Z";
  const history = Array.from({ length: 6 }, (_, i) =>
    g(["ironman", "x"], ["y", "z"], "A", `2026-11-18T12:${String((i + 1) * 5).padStart(2, "0")}:00Z`)
  );
  const ahead = gamesAheadByPlayer(
    [entry("ironman", arrived), entry("resting", arrived)],
    history
  );
  expect(ahead.get("ironman")).toBe(1.5);
  expect(ahead.get("resting")).toBe(-1.5);
});
