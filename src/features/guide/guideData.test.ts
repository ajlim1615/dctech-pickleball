import { describe, expect, it } from "vitest";
import { MATCHING_STYLE_REGISTRY } from "@/features/queue/constants/matchingStyles";
import { getVisibleGuideTabs, PLAYER_FAQS, PLAYER_FLOW_STEPS, resolveGuideTab } from "./data/guideData";

describe("guideData role gating & tab resolution", () => {
  it("shows only player tabs when user is a regular player", () => {
    const tabs = getVisibleGuideTabs({ canViewStaff: false, canViewAdmin: false });
    expect(tabs.map((t) => t.id)).toEqual(["rules", "flow", "matchstyles", "faq"]);
  });

  it("adds staff tab for staff role without exposing admin tab", () => {
    const tabs = getVisibleGuideTabs({ canViewStaff: true, canViewAdmin: false });
    expect(tabs.map((t) => t.id)).toEqual(["rules", "flow", "matchstyles", "faq", "staff"]);
  });

  it("shows both staff and admin tabs for admin role", () => {
    const tabs = getVisibleGuideTabs({ canViewStaff: true, canViewAdmin: true });
    expect(tabs.map((t) => t.id)).toEqual([
      "rules",
      "flow",
      "matchstyles",
      "faq",
      "staff",
      "admin",
    ]);
  });

  it("resolves deep-linked tabs safely according to role", () => {
    expect(resolveGuideTab("matchstyles", { canViewStaff: false, canViewAdmin: false })).toBe(
      "matchstyles"
    );
    expect(resolveGuideTab("staff", { canViewStaff: false, canViewAdmin: false })).toBe("rules");
    expect(resolveGuideTab("admin", { canViewStaff: true, canViewAdmin: false })).toBe("rules");
    expect(resolveGuideTab("staff", { canViewStaff: true, canViewAdmin: false })).toBe("staff");
    expect(resolveGuideTab("admin", { canViewStaff: true, canViewAdmin: true })).toBe("admin");
    expect(resolveGuideTab(["flow", "faq"], { canViewStaff: false, canViewAdmin: false })).toBe(
      "flow"
    );
    expect(resolveGuideTab("unknown", { canViewStaff: true, canViewAdmin: true })).toBe("rules");
  });
});

describe("guideData fair matching copy & FAQ", () => {
  it("explains fair game pace, late arrivals, and breaks in PLAYER_FAQS", () => {
    const fairFaq = PLAYER_FAQS.find(
      (item) =>
        item.question.toLowerCase().includes("more games") &&
        item.question.toLowerCase().includes("fair matching")
    );
    expect(fairFaq).toBeDefined();
    expect(fairFaq!.answer).toMatch(/#1/);
    expect(fairFaq!.answer.toLowerCase()).toMatch(/eight|top 8|top-8/);
    expect(fairFaq!.answer.toLowerCase()).toMatch(/arrival|late/);
    expect(fairFaq!.answer.toLowerCase()).toMatch(/break/);
  });

  it("mentions live wait timers and session game counts in PLAYER_FLOW_STEPS step 03", () => {
    const step03 = PLAYER_FLOW_STEPS.find((s) => s.step === "03");
    expect(step03).toBeDefined();
    expect(step03!.description.toLowerCase()).toMatch(/wait timer/);
    expect(step03!.description.toLowerCase()).toMatch(/game count/);
  });

  it("updates matching style guide descriptions to reference the 8-player window and fair game pace", () => {
    for (const style of ["balanced", "social_mixer", "skill_separated"] as const) {
      const desc = MATCHING_STYLE_REGISTRY[style].guideDescription.toLowerCase();
      expect(desc).not.toContain("first six");
      expect(desc).not.toContain("first ten");
      expect(desc).toMatch(/first eight|eight/);
      expect(desc).toMatch(/games played|game pace/);
    }
  });
});
