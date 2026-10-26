import { describe, it, expect } from "vitest";
import { decide } from "./index";
import { e, game, ids, input, sorted } from "./testHelpers";
import type { Teams } from "./types";

describe("decide: balanced, social mix and fifo", () => {
  it("holds with fewer than four waiting", () =>
    expect(decide(input("balanced", ids(3)))).toEqual({ hold: "not_enough_players", needed: 1 }));

  it("balanced pairs strongest+weakest vs middle with no history", () => {
    const line = [e("a", 4.5), e("b", 4), e("c", 3.5), e("d", 3), e("x", 3), e("y", 3)];
    expect(sorted(decide(input("balanced", line)))).toEqual(sorted({ teamA: ["a", "d"], teamB: ["b", "c"] }));
  });

  it("balanced reaches #5 to split up last game's partners", () => {
    const line = ["1", "2", "3", "4", "5", "6"].map((i) => e(i, 3));
    const h = [game(["1", "2"], ["3", "4"]), game(["1", "3"], ["2", "4"]), game(["1", "4"], ["2", "3"])];
    const d = decide(input("balanced", line, h)) as Teams;
    expect([...d.teamA, ...d.teamB]).toContain("5");
    expect([...d.teamA, ...d.teamB]).toContain("1");
  });

  it("balanced won't pull in much stronger players to avoid repeats", () => {
    const line = [e("1", 3), e("2", 3), e("3", 3), e("4", 3), e("5", 5), e("6", 5)];
    const d = decide(input("balanced", line, [game(["1", "2"], ["3", "4"])])) as Teams;
    expect([...d.teamA, ...d.teamB].sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("social mix ignores ratings and avoids repeat partners", () => {
    const line = [e("1", 5), e("2", 2), e("3", 5), e("4", 2)];
    const d = decide(input("social_mixer", line, [game(["1", "2"], ["3", "4"])])) as Teams;
    expect(d.teamA.includes("1") && d.teamA.includes("2")).toBe(false);
    expect(d.teamB.includes("1") && d.teamB.includes("2")).toBe(false);
  });

  it("first in line is always called", () => {
    for (const style of ["balanced", "social_mixer", "fifo"] as const) {
      const d = decide(input(style, ids(6), [game(["p1", "p2"], ["p3", "p4"])])) as Teams;
      expect([...d.teamA, ...d.teamB]).toContain("p1");
    }
  });

  it("never looks past six", () => {
    const line = [...ids(6).map((x) => ({ ...x, rating: 3 })), e("p7", 3)];
    const h = Array.from({ length: 5 }, () => game(["p1", "p2"], ["p3", "p4"]));
    const d = decide(input("balanced", line, h)) as Teams;
    expect([...d.teamA, ...d.teamB]).not.toContain("p7");
  });

  it("a locked pair plays together", () => {
    const line = [e("1"), e("2", 3, "g"), e("3"), e("4", 3, "g"), e("5"), e("6")];
    for (const style of ["balanced", "social_mixer", "fifo"] as const) {
      const d = decide(input(style, line)) as Teams;
      const team = d.teamA.includes("2") ? d.teamA : d.teamB;
      if ([...d.teamA, ...d.teamB].includes("2")) expect(team).toContain("4");
    }
  });

  it("fifo is #1+#2 vs #3+#4", () =>
    expect(decide(input("fifo", ids(6)))).toEqual({ teamA: ["p1", "p2"], teamB: ["p3", "p4"] }));

  it("force uses balanced", () => {
    const line = [e("a", 4.5), e("b", 4), e("c", 3.5), e("d", 3)];
    expect(sorted(decide({ ...input("fifo", line), force: true }))).toEqual(sorted({ teamA: ["a", "d"], teamB: ["b", "c"] }));
  });
});
