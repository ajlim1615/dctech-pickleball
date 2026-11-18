import { describe, expect, it } from "vitest";
import { deletionConcernsUs, upNextSubscriptions } from "./hooks/useLiveUpNext";

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
