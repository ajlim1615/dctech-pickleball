import { describe, it, expect, vi } from "vitest";
import { logSessionEvent, type SupabaseLike } from "@/features/activity/server/logEvent";

function fakeClient(result: () => Promise<{ error: { message: string } | null }>) {
  const rows: object[] = [];
  const client: SupabaseLike = {
    from: () => ({
      insert: (row: object) => {
        rows.push(row);
        return result();
      },
    }),
  };
  return { client, rows };
}

describe("logSessionEvent", () => {
  it("inserts one row with the mapped columns", async () => {
    const { client, rows } = fakeClient(async () => ({ error: null }));
    await logSessionEvent(client, { sessionId: "s1", type: "break_started", actorId: "p1", actorRole: "self" });
    expect(rows).toEqual([
      {
        session_id: "s1",
        type: "break_started",
        actor_id: "p1",
        actor_role: "self",
        subject_ids: [],
        court_id: null,
        match_id: null,
        details: {},
      },
    ]);
  });

  it("resolves when the insert returns an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient(async () => ({ error: { message: "relation does not exist" } }));
    await expect(
      logSessionEvent(client, { sessionId: "s1", type: "checked_in", actorId: "p1", actorRole: "self" })
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("resolves when the insert throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient(async () => {
      throw new Error("network down");
    });
    await expect(
      logSessionEvent(client, { sessionId: null, type: "court_closed", actorId: "a1", actorRole: "admin" })
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
