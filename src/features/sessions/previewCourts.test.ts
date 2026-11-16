import { describe, expect, it } from "vitest";
import { previewCourts } from "@/features/sessions/utils/previewCourts";
import type { ActiveCourtView } from "@/types";

const court = (n: number, extra: Partial<ActiveCourtView> = {}): ActiveCourtView =>
  ({
    id: `c${n}`,
    name: `Court ${n}`,
    surface_type: "Standard Court",
    status: "available",
    sort_order: n,
    current_match_id: null,
    assigned_staff_id: null,
    created_at: "",
    updated_at: "",
    ...extra,
  }) as ActiveCourtView;

describe("previewCourts", () => {
  it("shows only the session's courts when the arena has more", () => {
    const shown = previewCourts([court(1), court(2), court(3), court(4)], 2);
    expect(shown.map((c) => c.name)).toEqual(["Court 1", "Court 2"]);
  });

  it("adds placeholders when the session needs more courts than the arena has", () => {
    const shown = previewCourts([court(1), court(2)], 4);
    expect(shown.map((c) => c.name)).toEqual(["Court 1", "Court 2", "Court 3", "Court 4"]);
    expect(shown[3].id).toBe("preview-court-4");
  });

  it("shows every court free, in court order", () => {
    const shown = previewCourts([court(2, { status: "occupied", current_match_id: "m" }), court(1)], 2);
    expect(shown.map((c) => c.name)).toEqual(["Court 1", "Court 2"]);
    expect(shown.every((c) => c.status === "available" && c.current_match_id === null)).toBe(true);
  });
});
