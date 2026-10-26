import { describe, it, expect } from "vitest";
import { decide, type Teams } from "./index";
import { e, ids, game, input } from "./testHelpers";

describe("winners / losers", () => {
  it("reaches down the line for a fourth winner", () => {
    const h = [game(["w1", "w2"], ["l1", "lx"], "A"), game(["w3", "w4"], ["ly", "lz"], "A")];
    const line = [e("w1"), e("w2"), e("w3"), e("l1"), e("w4"), e("n1")];
    const d = decide(input("winners_losers", line, h)) as Teams;
    expect([...d.teamA, ...d.teamB].sort()).toEqual(["w1", "w2", "w3", "w4"]);
  });

  it("splits a winning team that stays together in the four", () => {
    const h = [game(["w1", "w2"], ["l1", "l2"], "A"), game(["w3", "w4"], ["l3", "l4"], "A")];
    const d = decide(input("winners_losers", [e("w1"), e("w2"), e("w3"), e("w4")], h)) as Teams;
    expect(d.teamA.includes("w1") && d.teamA.includes("w2")).toBe(false);
    expect(d.teamB.includes("w1") && d.teamB.includes("w2")).toBe(false);
  });

  it("lets newcomers fill either side", () => {
    const h = [game(["w1", "w2"], ["l1", "l2"], "A")];
    const d = decide(input("winners_losers", [e("w1"), e("w2"), e("n1"), e("n2"), e("l1")], h)) as Teams;
    expect([...d.teamA, ...d.teamB].sort()).toEqual(["n1", "n2", "w1", "w2"]);
  });

  it("never places players who are not in line (web bug)", () => {
    const h = [game(["gone1", "gone2"], ["x", "y"], "A")];
    const d = decide(input("winners_losers", ids(4), h)) as Teams;
    expect([...d.teamA, ...d.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });
});

describe("skill separated", () => {
  it("keeps the four within the spread", () => {
    const line = [e("1", 3), e("2", 4.5), e("3", 3.5), e("4", 3.25), e("5", 3), e("6", 5)];
    const d = decide(input("skill_separated", line)) as Teams;
    expect([...d.teamA, ...d.teamB].sort()).toEqual(["1", "3", "4", "5"]);
  });

  it("lets others play when #1 has no match", () => {
    const line = [e("out", 2), e("2", 4), e("3", 4), e("4", 4.5), e("5", 4.25)];
    const d = decide(input("skill_separated", line));
    expect("teamA" in d).toBe(true);
    const t = d as Teams;
    expect([...t.teamA, ...t.teamB].sort()).toEqual(["2", "3", "4", "5"]);
  });

  it("holds when no group fits, and force overrides", () => {
    const line = [e("1", 2), e("2", 3), e("3", 4), e("4", 5)];
    expect(decide(input("skill_separated", line))).toEqual({ hold: "no_skill_match" });
    expect("teamA" in decide({ ...input("skill_separated", line), force: true })).toBe(true);
  });

  it("skill courts behaves like skill separated for now", () =>
    expect(decide(input("skill_courts", [e("1", 2), e("2", 3), e("3", 4), e("4", 5)]))).toEqual({ hold: "no_skill_match" }));
});
