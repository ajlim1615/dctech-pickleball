import { describe, expect, it } from "vitest";
import { planStartingLine, shuffle } from "./startingLine";

const NOW = new Date("2026-11-17T09:00:00.000Z");

/** Deterministic random sequence for repeatable shuffles. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function lineOrder(plan: ReturnType<typeof planStartingLine>, idToPlayer: Record<string, string>) {
  return [
    ...plan.reorder.map((r) => ({ who: idToPlayer[r.id], at: r.joinedAt })),
    ...plan.add.map((a) => ({ who: a.playerId, at: a.joinedAt })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((x) => x.who);
}

describe("shuffle", () => {
  it("keeps every item exactly once", () => {
    const out = shuffle([1, 2, 3, 4, 5, 6], seeded(7));
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("planStartingLine", () => {
  it("puts every going player and every pre-queued player in line once", () => {
    const plan = planStartingLine({
      goingPlayerIds: ["a", "b", "c", "d"],
      existing: [
        { id: "e1", player_id: "c", group_id: null },
        { id: "e2", player_id: "x", group_id: null },
      ],
      now: NOW,
      random: seeded(1),
    });
    const order = lineOrder(plan, { e1: "c", e2: "x" });
    expect(order.slice().sort()).toEqual(["a", "b", "c", "d", "x"]);
    // c was already queued: moved, not added twice
    expect(plan.add.map((a) => a.playerId).sort()).toEqual(["a", "b", "d"]);
    expect(plan.reorder.map((r) => r.id).sort()).toEqual(["e1", "e2"]);
  });

  it("does not keep the pre-queue order (first tap is not first in line)", () => {
    const existing = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, player_id: `p${i}`, group_id: null }));
    const map = Object.fromEntries(existing.map((e) => [e.id, e.player_id]));
    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        lineOrder(planStartingLine({ goingPlayerIds: [], existing, now: NOW, random: seeded(seed) }), map).join(",")
      )
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("keeps a pair next to each other", () => {
    const existing = [
      { id: "e1", player_id: "p1", group_id: "g" },
      { id: "e2", player_id: "solo", group_id: null },
      { id: "e3", player_id: "p2", group_id: "g" },
    ];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const order = lineOrder(
        planStartingLine({ goingPlayerIds: ["n1", "n2"], existing, now: NOW, random: seeded(seed) }),
        { e1: "p1", e2: "solo", e3: "p2" }
      );
      expect(Math.abs(order.indexOf("p1") - order.indexOf("p2"))).toBe(1);
    }
  });

  it("places the whole line before now, so later joiners go to the back", () => {
    const plan = planStartingLine({
      goingPlayerIds: ["a", "b", "c"],
      existing: [{ id: "e1", player_id: "d", group_id: null }],
      now: NOW,
    });
    const times = [...plan.reorder.map((r) => r.joinedAt), ...plan.add.map((a) => a.joinedAt)];
    expect(times.every((t) => new Date(t).getTime() < NOW.getTime())).toBe(true);
    expect(new Set(times).size).toBe(times.length);
  });

  it("ignores duplicate going ids and handles an empty session", () => {
    expect(planStartingLine({ goingPlayerIds: ["a", "a"], existing: [], now: NOW }).add).toHaveLength(1);
    expect(planStartingLine({ goingPlayerIds: [], existing: [], now: NOW })).toEqual({ reorder: [], add: [] });
  });
});
