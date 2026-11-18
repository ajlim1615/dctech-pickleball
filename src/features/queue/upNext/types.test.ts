import { describe, it, expect } from "vitest";
import { sameAutoCards, toUpNextCards } from "./types";

describe("toUpNextCards", () => {
  it("orders cards by position and players by slot", () => {
    const cards = toUpNextCards(
      [
        { id: "b", position: 2, per_side: 2, target_court_id: null, is_auto: true },
        { id: "a", position: 1, per_side: 2, target_court_id: "c1", is_auto: false },
      ],
      [
        { card_id: "a", player_id: "p2", team: "team_a", slot: 2 },
        { card_id: "a", player_id: "p1", team: "team_a", slot: 1 },
        { card_id: "a", player_id: "p3", team: "team_b", slot: 1 },
      ]
    );
    expect(cards.map((c) => c.id)).toEqual(["a", "b"]);
    expect(cards[0]).toMatchObject({ teamA: ["p1", "p2"], teamB: ["p3"], isAuto: false, targetCourtId: "c1", perSide: 2 });
    expect(cards[1]).toMatchObject({ teamA: [], teamB: [] });
  });

  it("cards carry names from their own rows", () => {
    const cards = toUpNextCards(
      [{ id: "a", position: 1, per_side: 2, target_court_id: null, is_auto: true }],
      [
        { card_id: "a", player_id: "p1", team: "team_a", slot: 1, player: { full_name: "Ana Lim", display_name: null } },
        { card_id: "a", player_id: "p2", team: "team_a", slot: 2, player: { full_name: null, display_name: "Ben Cruz" } },
        { card_id: "a", player_id: "p3", team: "team_b", slot: 1, player: null },
      ]
    );
    expect(cards[0].names).toEqual({
      p1: "Ana Lim",
      p2: "Ben Cruz",
      p3: "Player",
    });
  });
});

describe("sameAutoCards", () => {
  const saved = [
    { id: "m", position: 1, perSide: 2 as const, targetCourtId: null, isAuto: false, teamA: ["x"], teamB: [], names: {} },
    { id: "a", position: 2, perSide: 2 as const, targetCourtId: null, isAuto: true, teamA: ["p1", "p2"], teamB: ["p3", "p4"], names: {} },
  ];
  it("ignores hand-edited cards and matches identical auto cards", () => {
    expect(sameAutoCards(saved, [{ teamA: ["p1", "p2"], teamB: ["p3", "p4"], targetCourtId: null }])).toBe(true);
  });
  it("spots a different team", () => {
    expect(sameAutoCards(saved, [{ teamA: ["p1", "p3"], teamB: ["p2", "p4"], targetCourtId: null }])).toBe(false);
  });
});
