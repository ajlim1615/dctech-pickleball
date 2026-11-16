import { describe, expect, it } from "vitest";
import {
  ADMIN_MORE_MATCHING_STYLES,
  ADMIN_PRIMARY_MATCHING_STYLES,
  ALL_MATCHING_STYLES,
  GUIDE_MATCHING_STYLES,
  MATCHING_STYLE_REGISTRY,
} from "./matchingStyles";
import { parseSessionMetadata } from "@/lib/utils";

describe("MATCHING_STYLE_REGISTRY", () => {
  it("provides complete metadata for every MatchingStyle", () => {
    expect(ALL_MATCHING_STYLES.length).toBe(10);
    for (const style of ALL_MATCHING_STYLES) {
      const meta = MATCHING_STYLE_REGISTRY[style];
      expect(meta.id).toBe(style);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.adminSummary.length).toBeGreaterThan(0);
      expect(meta.guideDescription.length).toBeGreaterThan(0);
      expect(meta.strategy.length).toBeGreaterThan(0);
      expect(meta.bestFor.length).toBeGreaterThan(0);
    }
  });

  it("includes every style in GUIDE_MATCHING_STYLES and parses all modes in session metadata", () => {
    expect(GUIDE_MATCHING_STYLES.map((s) => s.id)).toEqual(ALL_MATCHING_STYLES);
    for (const style of ALL_MATCHING_STYLES) {
      const parsed = parseSessionMetadata(`[matching_mode:${style}]`);
      expect(parsed.matchingMode).toBe(style);
    }
  });

  it("partitions admin picker styles cleanly between primary and more tiers", () => {
    const primaryIds = ADMIN_PRIMARY_MATCHING_STYLES.map((s) => s.id);
    const moreIds = ADMIN_MORE_MATCHING_STYLES.map((s) => s.id);
    expect(primaryIds).toEqual(["balanced", "social_mixer", "skill_separated", "winners_losers"]);
    expect(moreIds).toEqual(["skill_courts", "mixed_doubles", "king_queen", "club_wars"]);
  });
});
