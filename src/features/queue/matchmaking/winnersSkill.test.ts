import { describe, it, expect } from "vitest";
import { decide, type LineEntry, type PastGame, type Teams } from "./index";
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

  it("skill_separated and skill_courts use the 8-player window and fairness within skillSpread, while winners_losers stays within 6", () => {
    const t0 = "2026-11-18T12:00:00Z";
    let seq = 0;
    const entryAt = (playerId: string, rating = 3): LineEntry => ({ playerId, rating, arrivedAt: t0 });
    const soloGames = (playerId: string, count: number): PastGame[] =>
      Array.from({ length: count }, () => {
        seq += 1;
        return {
          courtId: "c1",
          teamA: [playerId, `sx${seq}a`],
          teamB: [`sx${seq}b`, `sx${seq}c`],
          winner: "A",
          endedAt: new Date(Date.UTC(2026, 10, 18, 12, 10, seq)).toISOString(),
        };
      });

    // Under-played p7 sits at #7 within skillSpread, p4 has 3 games; p9 at #9 is out of window
    const line9 = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"].map((id) => entryAt(id, 3));
    const h = [
      ...soloGames("p1", 2),
      ...soloGames("p2", 2),
      ...soloGames("p3", 2),
      ...soloGames("p4", 3),
      ...soloGames("p5", 2),
      ...soloGames("p6", 2),
      ...soloGames("p8", 2),
    ];
    for (const style of ["skill_separated", "skill_courts"] as const) {
      const d = decide(input(style, line9, h)) as Teams;
      expect([...d.teamA, ...d.teamB].sort()).toEqual(["p1", "p2", "p3", "p7"]);
    }

    // Never looks past 8 even if p9 is the only under-played peer
    const h9 = [...h, ...soloGames("p7", 2)];
    for (const style of ["skill_separated", "skill_courts"] as const) {
      const d = decide(input(style, line9, h9)) as Teams;
      expect([...d.teamA, ...d.teamB]).not.toContain("p9");
    }

    // Respects skillSpread: an under-played player outside skillSpread (4.5 vs 3.0) is not pulled in
    const hEqual = [
      ...soloGames("p1", 2),
      ...soloGames("p2", 2),
      ...soloGames("p3", 2),
      ...soloGames("p4", 2),
      ...soloGames("p5", 2),
      ...soloGames("p6", 2),
      ...soloGames("p8", 2),
    ];
    const lineSpread = line9.map((x) => (x.playerId === "p7" ? entryAt("p7", 4.5) : x));
    for (const style of ["skill_separated", "skill_courts"] as const) {
      const d = decide(input(style, lineSpread, hEqual)) as Teams;
      expect([...d.teamA, ...d.teamB].sort()).toEqual(["p1", "p2", "p3", "p4"]);
    }

    // winners_losers still stays strictly within 6
    const wlHistory = [
      game(["p1", "p2"], ["p3", "p4"], "A"),
      game(["p7", "wx1"], ["p5", "p6"], "A"),
    ];
    const wl = decide(input("winners_losers", ids(8), wlHistory)) as Teams;
    expect([...wl.teamA, ...wl.teamB]).not.toContain("p7");
  });
});
