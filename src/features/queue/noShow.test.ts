import { describe, it, expect } from "vitest";
import { canSwapNoShow, pickReplacement } from "@/features/queue/utils/noShow";

const entry = (id: string, player_id: string, minute: number) => ({
  id,
  player_id,
  joined_at: `2026-10-20T10:${String(minute).padStart(2, "0")}:00.000Z`,
});

describe("canSwapNoShow", () => {
  it("allows a swap only before the first point", () => {
    expect(canSwapNoShow(0, 0)).toBe(true);
    expect(canSwapNoShow(1, 0)).toBe(false);
    expect(canSwapNoShow(0, 2)).toBe(false);
  });
});

describe("pickReplacement", () => {
  it("returns the earliest waiting player", () => {
    const pick = pickReplacement([entry("q2", "p2", 5), entry("q1", "p1", 1), entry("q3", "p3", 9)], []);
    expect(pick).toEqual({ id: "q1", player_id: "p1" });
  });

  it("skips players already in the match", () => {
    const pick = pickReplacement([entry("q1", "p1", 1), entry("q2", "p2", 5)], ["p1"]);
    expect(pick).toEqual({ id: "q2", player_id: "p2" });
  });

  it("returns null when nobody is waiting", () => {
    expect(pickReplacement([], [])).toBeNull();
    expect(pickReplacement([entry("q1", "p1", 1)], ["p1"])).toBeNull();
  });
});
