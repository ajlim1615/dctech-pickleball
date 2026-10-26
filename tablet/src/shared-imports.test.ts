import { describe, it, expect } from "vitest";
import { getWinner } from "@/features/matches/utils/scoring";
import { decide } from "@/features/queue/matchmaking";

describe("shared rules", () => {
  it("are importable without Supabase", () => {
    expect(getWinner(11, 9, { targetPoints: 11, winByTwo: true })).toBe("A");
    expect(typeof decide).toBe("function");
  });
});
