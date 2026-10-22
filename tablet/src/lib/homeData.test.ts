import { describe, it, expect } from "vitest";
import { loadHomeData } from "./homeData";
import { makeState } from "../engine/fixtures";
import type { DeskSession, SessionState } from "../engine/types";

function session(id: string, status: DeskSession["status"], date = "2026-10-01"): DeskSession {
  return { ...makeState().session, id, status, date };
}

function deps(sessions: DeskSession[], failing: string[] = []) {
  return {
    listSessions: async () => sessions,
    loadSessionState: async (id: string): Promise<SessionState> => {
      if (failing.includes(id)) throw new Error("That session no longer exists.");
      return { ...makeState(), session: sessions.find((s) => s.id === id)! };
    },
  };
}

describe("loadHomeData", () => {
  it("lists every ended session, not just the most recent", async () => {
    const ended = Array.from({ length: 25 }, (_, i) => session(`s${i}`, "ended"));
    const data = await loadHomeData(deps(ended));
    expect(data.past).toHaveLength(25);
  });

  it("keeps a session whose details fail to load, without highlights", async () => {
    const data = await loadHomeData(deps([session("ok", "ended"), session("bad", "ended")], ["bad"]));
    expect(data.past.map((r) => r.session.id)).toEqual(["ok", "bad"]);
    expect(data.past[0].highlights).toEqual({ games: 0 });
    expect(data.past[1].highlights).toBeNull();
  });

  it("still lists past sessions when the live one fails to load", async () => {
    const data = await loadHomeData(deps([session("live", "live"), session("old", "ended")], ["live"]));
    expect(data.live).toEqual({ session: expect.objectContaining({ id: "live" }), stats: null });
    expect(data.past).toHaveLength(1);
  });
});
