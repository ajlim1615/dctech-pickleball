import { describe, it, expect } from "vitest";
import { buildMatchTeams, describeEvent } from "@/features/activity/utils/describeEvent";
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
    expect(describeEvent(e, names)).toBe("Court 3 started: Maria Santos & Jun Reyes vs Carlo Dizon & Bea Villanueva");
  });

  it("describes a win/loss-only game result using matchTeams from game_started", () => {
    const started = ev({
      id: "e0",
      type: "game_started",
      match_id: "m1",
      details: { courtName: "Court 3", teamA: ["maria", "jun"], teamB: ["carlo", "bea"] },
    });
    const finished = ev({
      id: "e1",
      type: "game_result",
      match_id: "m1",
      details: { courtName: "Court 3", scoreA: 0, scoreB: 1, winner: "team_b" },
    });
    const matchTeams = buildMatchTeams([finished, started]);
    expect(describeEvent(started, names, undefined, matchTeams)).toBe(
      "Game 1 @ Court 3 started: Maria Santos & Jun Reyes vs Carlo Dizon & Bea Villanueva"
    );
    expect(describeEvent(finished, names, undefined, matchTeams)).toBe(
      "Game 1 @ Court 3: Carlo Dizon & Bea Villanueva beat Maria Santos & Jun Reyes"
    );
  });

  it("describes a scored game result with teams", () => {
    const finished = ev({
      type: "game_result",
      match_id: "m2",
      details: {
        courtName: "Court 1",
        scoreA: 11,
        scoreB: 7,
        winner: "team_a",
        teamA: ["maria", "jun"],
        teamB: ["carlo", "bea"],
      },
    });
    expect(describeEvent(finished, names)).toBe(
      "Court 1: Maria Santos & Jun Reyes beat Carlo Dizon & Bea Villanueva (11-7)"
    );
  });

  it("avoids cryptic W-L when teams are unknown for a win/loss-only result", () => {
    const finished = ev({
      type: "game_result",
      details: { courtName: "Court 3", scoreA: 1, scoreB: 0, winner: "team_a" },
    });
    expect(describeEvent(finished, names)).toBe("Court 3 finished");
  });

  it("names added players when subject_ids are present", () => {
    const one = ev({ type: "players_added", actor_role: "admin", subject_ids: ["mark"], details: { count: 1 } });
    const two = ev({ type: "players_added", actor_role: "admin", subject_ids: ["mark", "ana"], details: { count: 2 } });
    const four = ev({
      type: "players_added",
      actor_role: "admin",
      subject_ids: ["mark", "ana", "rico", "joy"],
      details: { count: 4 },
    });
    expect(describeEvent(one, names)).toBe("An admin added Mark Aquino to the queue");
    expect(describeEvent(two, names)).toBe("An admin added Mark Aquino & Ana Lim to the queue");
    expect(describeEvent(four, names)).toBe("An admin added Mark Aquino, Ana Lim & 2 others to the queue");
  });

  it("prefers session courtNames over raw details.courtName when court_id matches", () => {
    const e = ev({
      type: "game_started",
      court_id: "c3",
      match_id: "m1",
      details: { courtName: "Court 3", teamA: ["maria", "jun"], teamB: ["carlo", "bea"] },
    });
    expect(describeEvent(e, names, undefined, { m1: { teamA: ["maria", "jun"], teamB: ["carlo", "bea"], gameNumber: 1 } }, { c3: "Court 1" })).toBe(
      "Game 1 @ Court 1 started: Maria Santos & Jun Reyes vs Carlo Dizon & Bea Villanueva"
    );
  });

  it("falls back to 'A player' for unknown people", () => {
    const e = ev({ type: "joined_queue", subject_ids: ["ghost"] });
    expect(describeEvent(e, names)).toContain("A player");
  });
});

describe("live-court and Up Next events", () => {
  const admin = { actor_role: "admin" as const, actor_name: "Ana" };
  it.each([
    [{ type: "court_player_replaced", subject_ids: ["rico", "joy"], details: { courtName: "Court 1", out: "rico", in: "joy" } }, "Ana put Joy Ramos in for Rico Tan on Court 1"],
    [{ type: "court_player_removed", subject_ids: ["rico"], details: { courtName: "Court 1", out: "rico" } }, "Ana took Rico Tan off Court 1"],
    [{ type: "court_teams_switched", subject_ids: ["rico", "joy"], details: { courtName: "Court 2" } }, "Ana switched Rico Tan and Joy Ramos on Court 2"],
    [{ type: "court_slot_filled", subject_ids: ["joy"], details: { courtName: "Court 2", in: "joy" } }, "Ana added Joy Ramos to Court 2"],
    [{ type: "court_change_undone", subject_ids: [], details: { courtName: "Court 2" } }, "Ana undid a change on Court 2"],
    [{ type: "up_next_edited", subject_ids: [], details: {} }, "Ana changed Up Next"],
  ] as const)("%o", (partial, text) => {
    const e = { ...ev({ ...(partial as unknown as Partial<SessionEvent>), actor_role: admin.actor_role }), actor_name: admin.actor_name };
    expect(describeEvent(e, names)).toBe(text);
  });
});
