import { describe, it, expect } from "vitest";
import type { UpNextCard } from "@/features/queue/upNext/types";
import { canSaveResult, canSendCard, cardForFreeCourt, chooseSlotsReducer } from "./courtRules";

const card = (id: string, over: Partial<UpNextCard> = {}): UpNextCard => ({
  id,
  position: 1,
  perSide: 2,
  targetCourtId: null,
  isAuto: true,
  teamA: ["a1", "a2"],
  teamB: ["b1", "b2"],
  ...over,
});

describe("cardForFreeCourt", () => {
  it("bound card shows only on its court", () => {
    const cards = [card("k1", { targetCourtId: "c2" })];
    expect(cardForFreeCourt("c1", ["c1", "c2"], cards)).toBeNull();
    expect(cardForFreeCourt("c2", ["c1", "c2"], cards)?.id).toBe("k1");
  });

  it("unbound cards spread across free courts in order", () => {
    const cards = [card("u1"), card("u2", { position: 2 })];
    expect(cardForFreeCourt("c1", ["c1", "c3"], cards)?.id).toBe("u1");
    expect(cardForFreeCourt("c3", ["c1", "c3"], cards)?.id).toBe("u2");
  });

  it("a court with its own bound card doesn't use up an unbound one", () => {
    const cards = [card("k1", { targetCourtId: "c1" }), card("u1", { position: 2 })];
    expect(cardForFreeCourt("c1", ["c1", "c2"], cards)?.id).toBe("k1");
    expect(cardForFreeCourt("c2", ["c1", "c2"], cards)?.id).toBe("u1");
  });

  it("no card when none left", () => {
    expect(cardForFreeCourt("c2", ["c1", "c2"], [card("u1")])).toBeNull();
  });
});

describe("canSaveResult", () => {
  it("false with 2 v 1", () => {
    expect(canSaveResult(["a", "b"], ["c"], 2)).toBe(false);
  });
  it("true when both sides are full", () => {
    expect(canSaveResult(["a", "b"], ["c", "d"], 2)).toBe(true);
    expect(canSaveResult(["a"], ["c"], 1)).toBe(true);
  });
});

describe("canSendCard", () => {
  it("false when the card is not full", () => {
    expect(canSendCard(card("u", { teamB: ["b1"] }), ["c1"])).toBe(false);
  });
  it("false when bound court busy", () => {
    expect(canSendCard(card("k", { targetCourtId: "c2" }), ["c1"])).toBe(false);
  });
  it("true for a full unbound card with any free court", () => {
    expect(canSendCard(card("u"), ["c3"])).toBe(true);
  });
});

describe("chooseSlotsReducer", () => {
  const empty = { teamA: [] as string[], teamB: [] as string[], active: "team_a" as const, perSide: 2 as const };

  it("fills A then B", () => {
    let s = chooseSlotsReducer(empty, { type: "pick", playerId: "p1" });
    s = chooseSlotsReducer(s, { type: "pick", playerId: "p2" });
    expect(s).toMatchObject({ teamA: ["p1", "p2"], active: "team_b" });
    s = chooseSlotsReducer(s, { type: "pick", playerId: "p3" });
    expect(s.teamB).toEqual(["p3"]);
  });

  it("clear reactivates that team", () => {
    const full = { ...empty, teamA: ["p1", "p2"], teamB: ["p3"], active: "team_b" as const };
    const s = chooseSlotsReducer(full, { type: "clear", playerId: "p1" });
    expect(s).toMatchObject({ teamA: ["p2"], active: "team_a" });
  });

  it("ignores picks when full", () => {
    const full = { ...empty, teamA: ["p1", "p2"], teamB: ["p3", "p4"], active: "team_b" as const };
    expect(chooseSlotsReducer(full, { type: "pick", playerId: "p5" })).toEqual(full);
  });

  it("ignores a player already picked", () => {
    const s = { ...empty, teamA: ["p1"] };
    expect(chooseSlotsReducer(s, { type: "pick", playerId: "p1" })).toEqual(s);
  });
});

describe("cardForFreeCourt skips incomplete cards", () => {
  it("an incomplete hand-edited card doesn't block the full ones behind it", () => {
    const cards = [card("half", { isAuto: false, teamB: ["b1"] }), card("full", { position: 2 })];
    expect(cardForFreeCourt("c1", ["c1"], cards)?.id).toBe("full");
  });
});
