import { describe, it, expect } from "vitest";
import { estimateWait, eventsAffecting } from "@/features/activity/utils/waitEstimate";
import type { SessionEvent } from "@/types";

describe("estimateWait", () => {
  it("says you're in the next game when you're in the first four", () => {
    expect(estimateWait({ position: 3, courtsInPlay: 4, avgGameMinutes: 14 })).toEqual({
      groupsAhead: 0,
      minutes: 0,
      nextGame: true,
    });
  });

  it("counts one game's wait for one group ahead", () => {
    expect(estimateWait({ position: 7, courtsInPlay: 4, avgGameMinutes: 14 })).toEqual({
      groupsAhead: 1,
      minutes: 14,
      nextGame: false,
    });
  });

  it("spreads groups ahead across the courts in play", () => {
    expect(estimateWait({ position: 13, courtsInPlay: 2, avgGameMinutes: 10 })).toMatchObject({
      groupsAhead: 3,
      minutes: 20,
    });
  });

  it("uses one court and 12 minutes when there's no data yet", () => {
    expect(estimateWait({ position: 5, courtsInPlay: 0, avgGameMinutes: null })).toMatchObject({
      groupsAhead: 1,
      minutes: 12,
    });
  });
});

describe("eventsAffecting", () => {
  const ev = (id: string, type: SessionEvent["type"], subjects: string[], minute: number): SessionEvent => ({
    id,
    session_id: "s1",
    type,
    actor_role: "admin",
    subject_ids: subjects,
    court_id: null,
    match_id: null,
    details: {},
    created_at: `2026-10-20T10:${String(minute).padStart(2, "0")}:00.000Z`,
  });

  it("returns only the player's relevant events, newest first, at most five", () => {
    const events = [
      ev("1", "moved_in_queue", ["mark"], 1),
      ev("2", "joined_queue", ["mark"], 2),
      ev("3", "break_started", ["joy"], 3),
      ev("4", "game_started", ["mark", "a", "b", "c"], 4),
      ev("5", "game_result", ["mark", "a", "b", "c"], 5),
      ev("6", "moved_in_queue", ["mark"], 6),
      ev("7", "no_show_swapped", ["x", "mark"], 7),
      ev("8", "result_corrected", ["mark"], 8),
    ];
    expect(eventsAffecting(events, "mark").map((e) => e.id)).toEqual(["8", "7", "6", "5", "4"]);
  });
});
