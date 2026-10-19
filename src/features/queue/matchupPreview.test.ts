import { describe, it, expect, vi, afterEach } from "vitest";
import { createMatchupFromPod, previewMatchupFromPod, seededRandom } from "./utils/matchingEngine";
import type { MatchingStyle } from "./utils/matchingEngine";
import type { Profile } from "@/types";

function player(id: string, skill_rating: number): Profile {
  return {
    id,
    email: `${id}@dctechmicro.com`,
    full_name: `Player ${id}`,
    display_name: id,
    avatar_url: null,
    role: "player",
    skill_rating,
    games_played: 0,
    games_won: 0,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

const pod = [player("p1", 4.5), player("p2", 4.0), player("p3", 3.5), player("p4", 2.5)];
const seed = "entry-a|entry-b|entry-c|entry-d";
const shuffledStyles: MatchingStyle[] = ["social_mixer", "club_wars", "mixed_doubles"];

const teamIds = (m: ReturnType<typeof createMatchupFromPod>) => [
  m.teamA.map((p) => p.id),
  m.teamB.map((p) => p.id),
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Matchup preview (render-safe)", () => {
  it.each(shuffledStyles)("returns the same teams and balance for the same input in %s mode", (style) => {
    const first = previewMatchupFromPod(pod, style, seed);
    for (let i = 0; i < 20; i++) {
      const again = previewMatchupFromPod(pod, style, seed);
      expect(teamIds(again)).toEqual(teamIds(first));
      expect(again.balanceScorePercent).toBe(first.balanceScorePercent);
    }
  });

  it("never touches Math.random, so server and client renders agree", () => {
    const spy = vi.spyOn(Math, "random");
    previewMatchupFromPod(pod, "social_mixer", seed);
    expect(spy).not.toHaveBeenCalled();
  });

  it("still places all four players exactly once", () => {
    const m = previewMatchupFromPod(pod, "social_mixer", seed);
    expect([...m.teamA, ...m.teamB].map((p) => p.id).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("produces different pairings for different queue entries", () => {
    const pairings = new Set(
      Array.from({ length: 30 }, (_, i) =>
        JSON.stringify(teamIds(previewMatchupFromPod(pod, "social_mixer", `seed-${i}`)))
      )
    );
    expect(pairings.size).toBeGreaterThan(1);
  });

  it("keeps real matchmaking random (uses Math.random by default)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    createMatchupFromPod(pod, "social_mixer");
    expect(spy).toHaveBeenCalled();
  });

  it("seededRandom is deterministic and stays in [0, 1)", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
