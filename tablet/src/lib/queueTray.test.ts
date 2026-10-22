import { describe, it, expect } from "vitest";
import { trayFor } from "./queueTray";
import type { DeskQueueEntry } from "../engine/types";

const entry = (id: string): DeskQueueEntry => ({
  id,
  sessionId: "s1",
  playerId: `p-${id}`,
  position: 1,
  status: "waiting",
  joinedAt: "2026-10-21T18:00:00.000Z",
  gamesPlayed: 0,
});

describe("trayFor", () => {
  it("tray closes when its row leaves the line", () => {
    const a = entry("a");
    const b = entry("b");
    expect(trayFor("b", [a, b])).toBe("b");
    expect(trayFor("b", [a])).toBeNull();
    expect(trayFor(null, [a, b])).toBeNull();
  });
});
