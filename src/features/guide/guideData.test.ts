import { describe, expect, it } from "vitest";
import { getVisibleGuideTabs, resolveGuideTab } from "./data/guideData";

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
