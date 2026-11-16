import { describe, it, expect } from "vitest";
import { podiumSlots } from "@/features/rankings/utils/podium";
import type { RankedPlayer } from "@/features/rankings/utils/leaderboard";

const ranked = (id: string, rank: number): RankedPlayer =>
  ({ id, rank, qualified: true, gamesToQualify: 0 }) as unknown as RankedPlayer;
const fresh = (id: string): RankedPlayer =>
  ({ id, rank: null, qualified: false, gamesToQualify: 5 }) as unknown as RankedPlayer;

describe("podiumSlots", () => {
  it("pads with nulls", () => {
    expect(podiumSlots([])).toEqual([null, null, null]);
    const q1 = ranked("a", 1);
    const q2 = ranked("b", 2);
    expect(podiumSlots([q1, q2, fresh("c"), fresh("d"), fresh("e"), fresh("f"), fresh("g")])).toEqual([q1, q2, null]);
  });

  it("skips new players", () => {
    const q1 = ranked("a", 1);
    expect(podiumSlots([fresh("x"), q1, fresh("y")])).toEqual([q1, null, null]);
  });

  it("takes only the first three qualified players", () => {
    const qs = [1, 2, 3, 4].map((n) => ranked(`q${n}`, n));
    expect(podiumSlots(qs).map((p) => p?.id)).toEqual(["q1", "q2", "q3"]);
  });
});
