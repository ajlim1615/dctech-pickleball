import { describe, it, expect } from "vitest";
import { insertQueueEntries, staggeredJoinTimes } from "@/features/queue/server/insertQueueEntries";

type Result = { error: { code?: string; message: string } | null };

function fake(results: Result[]) {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      from: () => ({
        insert: async (rows: unknown) => {
          calls.push(rows);
          return results.shift() ?? { error: null };
        },
      }),
    },
  };
}

const row = (player_id: string) => ({ session_id: "s", player_id, status: "waiting" as const });

describe("insertQueueEntries", () => {
  it("inserts the whole batch in one call when nothing clashes", async () => {
    const f = fake([{ error: null }]);
    expect(await insertQueueEntries(f.client, [row("a"), row("b")])).toEqual({ inserted: 2, skipped: 0 });
    expect(f.calls).toHaveLength(1);
  });

  it("falls back to one row at a time and skips players already in line", async () => {
    const f = fake([
      { error: { code: "23505", message: "dup" } },
      { error: null },
      { error: { code: "23505", message: "dup" } },
    ]);
    expect(await insertQueueEntries(f.client, [row("a"), row("b")])).toEqual({ inserted: 1, skipped: 1 });
    expect(f.calls).toHaveLength(3);
  });

  it("returns any other error", async () => {
    const f = fake([{ error: { code: "42501", message: "denied" } }]);
    expect(await insertQueueEntries(f.client, [row("a")])).toEqual({ inserted: 0, skipped: 0, error: "denied" });
  });

  it("does nothing for no rows", async () => {
    const f = fake([]);
    expect(await insertQueueEntries(f.client, [])).toEqual({ inserted: 0, skipped: 0 });
    expect(f.calls).toHaveLength(0);
  });
});

describe("staggeredJoinTimes", () => {
  it("spaces join times 1 ms apart in the given order", () => {
    expect(staggeredJoinTimes(3, new Date("2026-11-17T10:00:00.000Z"))).toEqual([
      "2026-11-17T10:00:00.000Z",
      "2026-11-17T10:00:00.001Z",
      "2026-11-17T10:00:00.002Z",
    ]);
    expect(staggeredJoinTimes(0, new Date())).toEqual([]);
  });
});
