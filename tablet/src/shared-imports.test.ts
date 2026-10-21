import { describe, it, expect } from "vitest";
import { getWinner } from "@/features/matches/utils/scoring";
import { selectPod } from "@/features/queue/utils/podSelection";

describe("shared rules", () => {
  it("are importable without Supabase", () => {
    expect(getWinner(11, 9, { targetPoints: 11, winByTwo: true })).toBe("A");
    expect(typeof selectPod).toBe("function");
  });
});
