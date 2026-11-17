import { describe, it, expect } from "vitest";
import { canSwapNoShow } from "@/features/queue/utils/noShow";

// Picking and claiming the replacement now happens in the database
// (swap_match_player, supabase/tests/swap_match_player.test.sql).

describe("canSwapNoShow", () => {
  it("allows a swap only before the first point", () => {
    expect(canSwapNoShow(0, 0)).toBe(true);
    expect(canSwapNoShow(1, 0)).toBe(false);
    expect(canSwapNoShow(0, 2)).toBe(false);
  });
});

describe("canSwapNoShow time window", () => {
  const start = "2026-10-20T10:00:00.000Z";
  it("allows a swap in the first five minutes", () => {
    expect(canSwapNoShow(0, 0, start, new Date("2026-10-20T10:04:00.000Z"))).toBe(true);
  });
  it("refuses a swap once the game has been going five minutes", () => {
    expect(canSwapNoShow(0, 0, start, new Date("2026-10-20T10:06:00.000Z"))).toBe(false);
  });
});
