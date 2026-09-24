import { describe, it, expect } from "vitest";
import { formatRating, formatScore, cn, parseSessionMetadata, cleanSessionDescription } from "./utils";

describe("utils", () => {
  it("formats rating properly", () => {
    expect(formatRating(3.5)).toBe("3.50");
    expect(formatRating("4.123")).toBe("4.12");
    expect(formatRating(null)).toBe("3.00");
  });

  it("formats match score properly", () => {
    expect(formatScore(11, 9)).toBe("11 - 9");
  });

  it("merges class names correctly", () => {
    expect(cn("bg-red-500", "p-4", false && "hidden")).toBe("bg-red-500 p-4");
  });

  it("parses session metadata correctly with defaults", () => {
    const defaultMeta = parseSessionMetadata(null);
    expect(defaultMeta.matchingMode).toBe("balanced");
    expect(defaultMeta.isRanked).toBe(true);
    expect(defaultMeta.targetPoints).toBe(11);
  });

  it("parses custom metadata for casual and 6-point speed play", () => {
    const raw = "Fun friday open play [matching_mode:social_mixer] [ranked:false] [target_points:6]";
    const meta = parseSessionMetadata(raw);
    expect(meta.matchingMode).toBe("social_mixer");
    expect(meta.isRanked).toBe(false);
    expect(meta.targetPoints).toBe(6);

    const clean = cleanSessionDescription(raw);
    expect(clean).toBe("Fun friday open play");
  });
});
