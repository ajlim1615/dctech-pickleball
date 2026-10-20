import { describe, it, expect } from "vitest";
import { describeEvent } from "@/features/activity/utils/describeEvent";
import type { SessionEvent } from "@/types";

const names: Record<string, string> = {
  mark: "Mark Aquino",
  rico: "Rico Tan",
  ana: "Ana Lim",
  joy: "Joy Ramos",
  maria: "Maria Santos",
  jun: "Jun Reyes",
  carlo: "Carlo Dizon",
  bea: "Bea Villanueva",
};

const ev = (e: Partial<SessionEvent>): SessionEvent => ({
  id: "e1",
  session_id: "s1",
  type: "joined_queue",
  actor_role: "self",
  subject_ids: [],
  court_id: null,
  match_id: null,
  details: {},
  created_at: "2026-10-20T10:00:00.000Z",
  ...e,
});

describe("describeEvent", () => {
  it("says an admin moved the viewer back", () => {
    const e = ev({ type: "moved_in_queue", actor_role: "admin", subject_ids: ["mark"], details: { positions: -4 } });
    expect(describeEvent(e, names, "mark")).toBe("An admin moved you back 4 places");
  });

  it("names the admin in the audit view", () => {
    const e = ev({ type: "moved_in_queue", actor_role: "admin", subject_ids: ["mark"], details: { positions: -4 } });
    expect(describeEvent({ ...e, actor_name: "Ana" }, names, "mark")).toBe("Ana moved you back 4 places");
  });

  it("describes a no-show swap", () => {
    const e = ev({
      type: "no_show_swapped",
      actor_role: "admin",
      subject_ids: ["rico", "ana"],
      details: { courtName: "Court 2", out: "rico", in: "ana" },
    });
    expect(describeEvent(e, names)).toBe("Rico Tan didn't show on Court 2; Ana Lim took the spot");
  });

  it("describes a corrected result", () => {
    const e = ev({
      type: "result_corrected",
      actor_role: "admin",
      details: { courtName: "Court 1", from: { a: 11, b: 9 }, to: { a: 9, b: 11 } },
    });
    expect(describeEvent(e, names)).toBe("An admin corrected a result on Court 1 from 11-9 to 9-11");
  });

  it("describes another player taking a break", () => {
    const e = ev({ type: "break_started", actor_role: "self", subject_ids: ["joy"] });
    expect(describeEvent(e, names, "mark")).toBe("Joy Ramos took a break");
  });

  it("describes an automatic game start", () => {
    const e = ev({
      type: "game_started",
      actor_role: "system",
      subject_ids: ["maria", "jun", "carlo", "bea"],
      details: { courtName: "Court 3", teamA: ["maria", "jun"], teamB: ["carlo", "bea"] },
    });
    expect(describeEvent(e, names)).toBe("Court 3: Maria Santos & Jun Reyes vs Carlo Dizon & Bea Villanueva");
  });

  it("falls back to 'A player' for unknown people", () => {
    const e = ev({ type: "joined_queue", subject_ids: ["ghost"] });
    expect(describeEvent(e, names)).toContain("A player");
  });
});
