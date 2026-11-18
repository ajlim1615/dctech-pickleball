import { describe, it, expect } from "vitest";
import { seededRandom } from "@/features/queue/matchmaking";
import { e, ids } from "@/features/queue/matchmaking/testHelpers";
import { buildAutoCards, pickReplacement } from "./buildCards";

const base = {
  style: "balanced" as const,
  history: [],
  courts: ["c1", "c2"],
  perSide: 2 as const,
  exclude: new Set<string>(),
  settings: {},
  random: seededRandom("cards"),
};

const players = (cards: { teamA: string[]; teamB: string[] }[]) => cards.flatMap((c) => [...c.teamA, ...c.teamB]);

describe("buildAutoCards", () => {
  it("builds count cards without reusing players", () => {
    const cards = buildAutoCards({ ...base, line: ids(10), count: 2 });
    expect(cards).toHaveLength(2);
    const all = players(cards);
    expect(new Set(all).size).toBe(8);
    for (const c of cards) {
      expect(c.teamA).toHaveLength(2);
      expect(c.teamB).toHaveLength(2);
    }
  });

  it("skips excluded players", () => {
    const cards = buildAutoCards({ ...base, line: ids(8), count: 1, exclude: new Set(["p1", "p2"]) });
    expect(players(cards)).not.toContain("p1");
    expect(players(cards)).not.toContain("p2");
  });

  it("stops at hold", () => {
    const cards = buildAutoCards({ ...base, line: ids(6), count: 2 });
    expect(cards).toHaveLength(1);
  });

  it("keeps pairs together", () => {
    const line = [e("p1"), e("p2"), e("p3"), e("p4", 3, "g"), e("p5", 3, "g"), e("p6"), e("p7"), e("p8")];
    const all = players(buildAutoCards({ ...base, line, count: 1 }));
    expect(all.includes("p4")).toBe(all.includes("p5"));
  });

  it("binds cards to courts for king_queen", () => {
    const cards = buildAutoCards({ ...base, style: "king_queen", line: ids(8), count: 2 });
    expect(cards.map((c) => c.targetCourtId)).toEqual(["c1", "c2"]);
    const free = buildAutoCards({ ...base, line: ids(8), count: 2 });
    expect(free.map((c) => c.targetCourtId)).toEqual([null, null]);
  });

  it("builds singles cards in line order", () => {
    const cards = buildAutoCards({ ...base, line: ids(5), count: 2, perSide: 1 });
    expect(cards.map((c) => [c.teamA, c.teamB])).toEqual([
      [["p1"], ["p2"]],
      [["p3"], ["p4"]],
    ]);
  });
});

describe("pickReplacement", () => {
  const staying = { teamA: ["s1"], teamB: ["s2", "s3"] };

  it("prefers players not in cards", () => {
    const line = [e("a", 3), e("b", 3)];
    expect(pickReplacement({ style: "fifo", line, staying, missingTeam: "team_a", inCards: new Set(["a"]), random: Math.random })).toBe("b");
  });

  it("falls back to carded players when no one else waits", () => {
    const line = [e("a", 3)];
    expect(pickReplacement({ style: "fifo", line, staying, missingTeam: "team_a", inCards: new Set(["a"]), random: Math.random })).toBe("a");
  });

  it("balances ratings", () => {
    const ratings = { s1: 4.0, s2: 3.0, s3: 3.0 };
    const line = [e("low", 2.0), e("high", 4.0)];
    expect(
      pickReplacement({ style: "balanced", line, staying, missingTeam: "team_a", inCards: new Set(), random: Math.random, ratings })
    ).toBe("low");
  });

  it("skips paired players", () => {
    const line = [e("paired", 3, "g"), e("solo", 3)];
    expect(pickReplacement({ style: "fifo", line, staying, missingTeam: "team_a", inCards: new Set(), random: Math.random })).toBe("solo");
  });

  it("returns null on empty line", () => {
    expect(pickReplacement({ style: "fifo", line: [], staying, missingTeam: "team_a", inCards: new Set(), random: Math.random })).toBeNull();
  });
});
