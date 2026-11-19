import { describe, it, expect } from "vitest";
import { throneRoom } from "@/features/rankings/utils/throneRoom";
import type { RankedPlayer } from "@/features/rankings/utils/leaderboard";

const p = (id: string, rank: number | null, games = 5, name = id): RankedPlayer =>
  ({
    id,
    full_name: name,
    display_name: null,
    email: `${id}@x.com`,
    avatar_url: null,
    skill_rating: 2,
    role: "player",
    is_active: true,
    employee_no: null,
    rank,
    tied: false,
    games_played: games,
    games_won: 0,
    games_lost: 0,
    win_rate: 0,
    qualified: rank !== null,
    gamesToQualify: 0,
  }) as RankedPlayer;

describe("throneRoom", () => {
  it("puts #1 on the throne, #2 and #3 as the left and right guards, and the rest kneeling", () => {
    const room = throneRoom([p("d", 4), p("c", 3), p("a", 1), p("e", 5), p("b", 2), p("new", null)]);
    expect(room.ruler?.id).toBe("a");
    expect(room.guards.left?.id).toBe("b");
    expect(room.guards.right?.id).toBe("c");
    expect(room.kneeling.map((x) => x.id)).toEqual(["d", "e"]);
    expect(room.tieBrokenBy).toBeNull();
  });

  it("leaves a guard post empty when there aren't enough ranked players", () => {
    const room = throneRoom([p("a", 1), p("b", 2)]);
    expect(room.guards).toEqual({ left: expect.objectContaining({ id: "b" }), right: null });
    expect(room.kneeling).toEqual([]);
  });

  it("never shares the throne: a tie at #1 goes to more games played", () => {
    const room = throneRoom([p("few", 1, 4), p("many", 1, 9)]);
    expect(room.ruler?.id).toBe("many");
    expect(room.guards.left?.id).toBe("few");
    expect(room.tieBrokenBy).toBe("games");
  });

  it("falls back to name A-Z when games are level too", () => {
    const room = throneRoom([p("z", 1, 5, "Zed"), p("a", 1, 5, "Ana")]);
    expect(room.ruler?.full_name).toBe("Ana");
    expect(room.tieBrokenBy).toBe("name");
  });

  it("has no ruler when no one is ranked yet", () => {
    expect(throneRoom([p("new", null)])).toEqual({
      ruler: null,
      guards: { left: null, right: null },
      kneeling: [],
      tieBrokenBy: null,
    });
  });

  it("only seats as many kneelers as there are spots", () => {
    const players = Array.from({ length: 20 }, (_, i) => p(`p${i}`, i + 1));
    expect(throneRoom(players, 12).kneeling).toHaveLength(12);
  });
});
