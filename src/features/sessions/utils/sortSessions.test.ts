import { describe, expect, it } from "vitest";
import { sortSessionsForDisplay } from "./sortSessions";

describe("sortSessionsForDisplay", () => {
  it("places active first, then scheduled soonest-first, then completed/cancelled newest-first", () => {
    const sorted = sortSessionsForDisplay([
      { id: "c-old", status: "completed" as const, start_time: "2026-11-10T10:00:00Z" },
      { id: "s-later", status: "scheduled" as const, start_time: "2026-11-22T10:00:00Z" },
      { id: "c-new", status: "completed" as const, start_time: "2026-11-17T10:00:00Z" },
      { id: "live", status: "active" as const, start_time: "2026-11-18T10:00:00Z" },
      { id: "s-soon", status: "scheduled" as const, start_time: "2026-11-19T10:00:00Z" },
      { id: "x", status: "cancelled" as const, start_time: "2026-11-15T10:00:00Z" },
    ]);

    expect(sorted.map((s) => s.id)).toEqual([
      "live",
      "s-soon",
      "s-later",
      "c-new",
      "c-old",
      "x",
    ]);
  });
});
