import { expect, it } from "vitest";
import { buildWindow, enumerateOptions, ratingOf, seededRandom, teamStats } from "./scoring";
import type { LineEntry } from "./types";

const e = (id: string, rating: number | null = 3, pairId?: string): LineEntry => ({ playerId: id, rating, pairId });

it("window is six, extended to first-in-line's partner", () => {
  const line = [e("p1", 3, "g"), ...["2", "3", "4", "5", "6", "7", "8"].map((i) => e(i)), e("p9", 3, "g")];
  expect(buildWindow(line).map((x) => x.playerId)).toEqual(["p1", "2", "3", "4", "5", "6", "p9"]);
});

it("drops a window member whose partner waits outside the window", () => {
  const line = [e("1"), e("2"), e("3"), e("4", 3, "g"), e("5"), e("6"), e("7"), e("8", 3, "g")];
  expect(buildWindow(line).map((x) => x.playerId)).toEqual(["1", "2", "3", "5", "6"]);
});

it("treats a pair as solo when the partner is not in line", () => {
  expect(buildWindow([e("1", 3, "g"), e("2"), e("3"), e("4")]).map((x) => x.playerId)).toEqual(["1", "2", "3", "4"]);
});

it("enumerates 10 sets x 3 splits from six with #1 required, and never splits a pair", () => {
  expect(enumerateOptions(["1", "2", "3", "4", "5", "6"].map((i) => e(i)), true)).toHaveLength(30);
  const paired = enumerateOptions([e("1"), e("2", 3, "g"), e("3", 3, "g"), e("4"), e("5")], true);
  for (const o of paired) {
    const ids = o.four.map((x) => x.playerId);
    expect(ids.includes("2")).toBe(ids.includes("3"));
    if (ids.includes("2")) expect(o.teams.teamA.includes("2")).toBe(o.teams.teamA.includes("3"));
  }
});

it("skips is 0 for the first four and grows with depth", () => {
  const opts = enumerateOptions(["1", "2", "3", "4", "5", "6"].map((i) => e(i)), true);
  expect(Math.min(...opts.map((o) => o.skips))).toBe(0);
  expect(Math.max(...opts.map((o) => o.skips))).toBe(6); // indices 0,3,4,5
});

it("teamStats matches the old balance formula", () => {
  const r = new Map([["a", 4], ["b", 3], ["c", 3], ["d", 3]]);
  expect(teamStats({ teamA: ["a", "b"], teamB: ["c", "d"] }, (id) => r.get(id)!)).toEqual(
    { teamARatingAvg: 3.5, teamBRatingAvg: 3, ratingDelta: 0.5, balanceScorePercent: 80 });
});

it("missing rating counts as 3.0", () => expect(ratingOf(e("x", null))).toBe(3));

it("seededRandom is deterministic per seed and stays in [0, 1)", () => {
  const a = seededRandom("x");
  const b = seededRandom("x");
  for (let i = 0; i < 100; i++) {
    const v = a();
    expect(v).toBe(b());
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
