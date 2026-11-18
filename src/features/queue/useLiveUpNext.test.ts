import { describe, expect, it } from "vitest";
import { deletionConcernsUs, resolveUpNextLoad, upNextSubscriptions } from "./hooks/useLiveUpNext";

describe("upNextSubscriptions", () => {
  it("filters INSERT and UPDATE by session_id and leaves DELETE unfiltered on both tables", () => {
    const subs = upNextSubscriptions("sess-1");
    expect(subs).toEqual([
      { event: "INSERT", table: "up_next_matches", filter: "session_id=eq.sess-1" },
      { event: "UPDATE", table: "up_next_matches", filter: "session_id=eq.sess-1" },
      { event: "DELETE", table: "up_next_matches" },
      { event: "INSERT", table: "up_next_players", filter: "session_id=eq.sess-1" },
      { event: "UPDATE", table: "up_next_players", filter: "session_id=eq.sess-1" },
      { event: "DELETE", table: "up_next_players" },
    ]);
  });
});

describe("deletionConcernsUs", () => {
  const known = new Set(["card-1", "card-2"]);

  it("is true for a deleted card id currently on screen", () => {
    expect(deletionConcernsUs("up_next_matches", { id: "card-1" }, known)).toBe(true);
  });

  it("is true for a deleted player row belonging to a card on screen", () => {
    expect(deletionConcernsUs("up_next_players", { card_id: "card-2" }, known)).toBe(true);
  });

  it("is false for unrelated card or player deletions", () => {
    expect(deletionConcernsUs("up_next_matches", { id: "card-99" }, known)).toBe(false);
    expect(deletionConcernsUs("up_next_players", { card_id: "card-99" }, known)).toBe(false);
    expect(deletionConcernsUs("up_next_matches", {}, known)).toBe(false);
    expect(deletionConcernsUs("up_next_players", {}, known)).toBe(false);
  });
});

describe("resolveUpNextLoad", () => {
  const rows = [{ id: "card-1", position: 1, per_side: 2, target_court_id: null, is_auto: true }];
  const players = [
    { card_id: "card-1", player_id: "p1", team: "team_a" as const, slot: 1, player: { full_name: "Ana Lim", display_name: null } },
  ];

  it("ignores responses when either query failed so visible cards are not wiped", () => {
    expect(
      resolveUpNextLoad({ seq: 2, latestSeq: 2, cancelled: false, rowsError: { message: "network" }, playersError: null, rows: null, players })
    ).toBeNull();
    expect(
      resolveUpNextLoad({ seq: 2, latestSeq: 2, cancelled: false, rowsError: null, playersError: { message: "network" }, rows, players: null })
    ).toBeNull();
  });

  it("ignores out-of-order responses from an older load", () => {
    expect(
      resolveUpNextLoad({ seq: 1, latestSeq: 2, cancelled: false, rowsError: null, playersError: null, rows, players })
    ).toBeNull();
  });

  it("returns parsed cards when current and error-free", () => {
    const cards = resolveUpNextLoad({ seq: 2, latestSeq: 2, cancelled: false, rowsError: null, playersError: null, rows, players });
    expect(cards).toHaveLength(1);
    expect(cards?.[0].names).toEqual({ p1: "Ana Lim" });
  });
});
