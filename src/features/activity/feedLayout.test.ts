import { describe, expect, it } from "vitest";
import { eventKind, groupEventsByDay, isHighlight } from "@/features/activity/utils/feedLayout";
import type { SessionEvent } from "@/types";

const ev = (id: string, created_at: string, type: SessionEvent["type"] = "joined_queue"): SessionEvent => ({
  id,
  session_id: "s1",
  type,
  actor_role: "self",
  subject_ids: [],
  court_id: null,
  match_id: null,
  details: {},
  created_at,
});

// 2026-11-17 18:30 in Manila (UTC+8)
const NOW = new Date("2026-11-17T10:30:00.000Z");

describe("groupEventsByDay", () => {
  it("labels Today, Yesterday and older days in Manila time", () => {
    const groups = groupEventsByDay(
      [
        ev("a", "2026-11-17T09:00:00.000Z"), // Tue 5:00 PM
        ev("b", "2026-11-16T15:30:00.000Z"), // Mon 11:30 PM
        ev("c", "2026-11-16T07:36:00.000Z"), // Mon 3:36 PM
        ev("d", "2026-11-14T02:00:00.000Z"), // Sat
      ],
      NOW
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Sat, Nov 14"]);
    expect(groups.map((g) => g.events.map((e) => e.id))).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("uses the Manila date, not UTC, near midnight", () => {
    // 2026-11-16 17:00 UTC is already Tue 1:00 AM in Manila
    const [group] = groupEventsByDay([ev("a", "2026-11-16T17:00:00.000Z")], NOW);
    expect(group.label).toBe("Today");
  });

  it("returns nothing for an empty feed", () => {
    expect(groupEventsByDay([], NOW)).toEqual([]);
  });
});

describe("eventKind", () => {
  it("makes the session and games stand out, and keeps line changes quiet", () => {
    expect(isHighlight(eventKind("session_started"))).toBe(true);
    expect(isHighlight(eventKind("game_result"))).toBe(true);
    expect(isHighlight(eventKind("joined_queue"))).toBe(false);
    expect(eventKind("court_closed")).toBe("court");
    expect(eventKind("result_corrected")).toBe("fix");
  });
});
