import { describe, expect, it } from "vitest";
import { queueClosedReason } from "./queueOpen";

describe("queueClosedReason", () => {
  it("is open only while the session is live", () => {
    expect(queueClosedReason("active")).toBeNull();
  });

  it("points players to I'm going before the start", () => {
    expect(queueClosedReason("scheduled")).toMatch(/I'm going/);
  });

  it("stays closed for finished, cancelled or missing sessions", () => {
    for (const s of ["completed", "cancelled", null, undefined] as const) {
      expect(queueClosedReason(s)).toBe("This session is not open for queueing.");
    }
  });
});
