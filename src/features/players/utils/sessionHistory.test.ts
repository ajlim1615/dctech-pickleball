import { describe, expect, it } from "vitest";
import {
  formatPlacementLabel,
  formatPlayerMatchScore,
  groupMatchesBySession,
  type FormattedPlayerMatch,
} from "./sessionHistory";

describe("formatPlayerMatchScore", () => {
  it("shows W or L for result-only (1-0 / 0-1) games", () => {
    expect(formatPlayerMatchScore(1, 0, "WIN")).toBe("W");
    expect(formatPlayerMatchScore(0, 1, "LOSS")).toBe("L");
  });

  it("shows point scores for regular scored games", () => {
    expect(formatPlayerMatchScore(11, 7, "WIN")).toBe("11 - 7");
    expect(formatPlayerMatchScore(8, 11, "LOSS")).toBe("8 - 11");
  });
});

describe("formatPlacementLabel", () => {
  it("formats podium and standard placements", () => {
    expect(formatPlacementLabel({ rank: 1, totalPlayers: 16 }, "completed")).toBe("🥇 1st of 16");
    expect(formatPlacementLabel({ rank: 2, totalPlayers: 12 }, "completed")).toBe("🥈 2nd of 12");
    expect(formatPlacementLabel({ rank: 3, totalPlayers: 10 }, "completed")).toBe("🥉 3rd of 10");
    expect(formatPlacementLabel({ rank: 5, totalPlayers: 18 }, "completed")).toBe("#5 of 18");
    expect(formatPlacementLabel({ rank: 2, totalPlayers: 16, tied: true }, "active")).toBe("Live · 🥈 T-2nd of 16");
  });

  it("returns null when placement is missing or invalid", () => {
    expect(formatPlacementLabel(null)).toBeNull();
    expect(formatPlacementLabel({ rank: 0, totalPlayers: 10 })).toBeNull();
  });
});

describe("groupMatchesBySession", () => {
  it("groups matches by sessionId and tallies W/L/T/LIVE", () => {
    const base: Omit<FormattedPlayerMatch, "id" | "result"> = {
      sessionId: "s1",
      sessionTitle: "Balhai CrossCourt",
      sessionStatus: "completed",
      court: "Court 1",
      format: "Doubles (2v2)",
      date: "Nov 17, 2026",
      score: "11 - 7",
      duration: "12m 13s",
      placement: { rank: 1, totalPlayers: 16 },
    };
    const grouped = groupMatchesBySession([
      { ...base, id: "m1", result: "WIN" },
      { ...base, id: "m2", result: "LOSS", score: "8 - 11" },
      {
        ...base,
        id: "m3",
        sessionId: "s2",
        sessionTitle: "DC TECH Sports Day",
        date: "Nov 12, 2026",
        result: "WIN",
        placement: { rank: 2, totalPlayers: 12 },
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].sessionTitle).toBe("Balhai CrossCourt");
    expect(grouped[0].wins).toBe(1);
    expect(grouped[0].losses).toBe(1);
    expect(grouped[0].matches).toHaveLength(2);
    expect(grouped[0].placement).toEqual({ rank: 1, totalPlayers: 16 });
    expect(grouped[1].sessionTitle).toBe("DC TECH Sports Day");
    expect(grouped[1].wins).toBe(1);
  });
});
