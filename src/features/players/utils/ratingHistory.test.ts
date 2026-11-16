import { describe, expect, it } from "vitest";
import { gameRows, isAdminAdjustment, lastGameChange } from "./ratingHistory";

type Row = { reason: "game" | "correction" | "admin"; match_id: string | null; rating_change: number };

const game = (change: number, reason: "game" | "correction" = "game"): Row => ({
  reason,
  match_id: "m1",
  rating_change: change,
});
const admin = (change: number): Row => ({ reason: "admin", match_id: null, rating_change: change });

describe("ratingHistory", () => {
  it("treats reason admin or a missing match as an admin adjustment", () => {
    expect(isAdminAdjustment(admin(1))).toBe(true);
    expect(isAdminAdjustment({ reason: "game", match_id: null })).toBe(true);
    expect(isAdminAdjustment(game(0.1))).toBe(false);
    expect(isAdminAdjustment(game(0.1, "correction"))).toBe(false);
  });

  it("splits game rows from admin rows", () => {
    const rows = [game(0.1), admin(1.2), game(-0.2, "correction")];
    expect(gameRows(rows)).toEqual([rows[0], rows[2]]);
  });

  it("last game change skips a trailing admin edit", () => {
    expect(lastGameChange([game(0.1), game(-0.3), admin(0.9)])).toBe(-0.3);
  });

  it("last game change is 0 with no games", () => {
    expect(lastGameChange([])).toBe(0);
    expect(lastGameChange([admin(0.5)])).toBe(0);
  });
});
