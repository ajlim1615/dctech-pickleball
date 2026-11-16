import { describe, expect, it } from "vitest";
import { courtCapacity } from "@/features/sessions/utils/courtCapacity";

describe("courtCapacity", () => {
  it("fills courts in order and benches the rest", () => {
    expect(courtCapacity(4, 24)).toEqual({ playing: 16, waiting: 8, openSpots: 0, perCourt: [4, 4, 4, 4] });
  });

  it("leaves open spots when fewer people are going", () => {
    expect(courtCapacity(2, 5)).toEqual({ playing: 5, waiting: 0, openSpots: 3, perCourt: [4, 1] });
  });

  it("handles an empty session", () => {
    expect(courtCapacity(4, 0)).toEqual({ playing: 0, waiting: 0, openSpots: 16, perCourt: [0, 0, 0, 0] });
  });
});
