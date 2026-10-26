import { describe, it, expect } from "vitest";
import { formatRating, formatScore, cn, parseSessionMetadata, cleanSessionDescription, parseSkillSpread } from "./utils";

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

  it("parses the win-by rule, defaulting by target points for older sessions", () => {
    expect(parseSessionMetadata("[target_points:11]").winByTwo).toBe(true);
    expect(parseSessionMetadata("[target_points:6]").winByTwo).toBe(false);
    expect(parseSessionMetadata("[target_points:11] [win_by:1]").winByTwo).toBe(false);
    expect(parseSessionMetadata("[target_points:6] [win_by:2]").winByTwo).toBe(true);
    expect(cleanSessionDescription("Open play [target_points:11] [win_by:1]")).toBe("Open play");
  });

  it("parses skill spread with default and clamp", () => {
    expect(parseSessionMetadata("[matching_mode:skill_separated] [skill_spread:1.25]").skillSpread).toBe(1.25);
    expect(parseSessionMetadata("[matching_mode:balanced]").skillSpread).toBe(0.75);
    expect(parseSkillSpread("9")).toBe(2);
    expect(parseSkillSpread("abc")).toBe(0.75);
  });

  it("strips the skill spread tag", () =>
    expect(cleanSessionDescription("Fun night [skill_spread:0.5]")).toBe("Fun night"));
});
