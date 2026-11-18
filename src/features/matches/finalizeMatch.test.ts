import { describe, it, expect, vi, beforeEach } from "vitest";

const callNextUp = vi.fn();
const afterLineChange = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/security/authGuard", () => ({
  requireAdminUser: async () => ({ context: { userId: "admin-1" } }),
}));
vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: () => ({ success: true }),
  RATE_LIMIT_CONFIGS: { MATCH_ACTIONS: {} },
}));
vi.mock("@/features/activity/server/logEvent", () => ({ recordSessionEvent: vi.fn() }));
vi.mock("@/features/queue/api/queueActions", () => ({ callNextUp }));
vi.mock("@/features/queue/server/afterLineChange", () => ({ afterLineChange }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { session_id: "s1", court_id: "c1", status: "in_progress", sessions: { description: "[ranked:false]", status: "active" } },
          }),
        }),
      }),
    }),
    rpc,
  }),
}));

describe("finalizeMatch", () => {
  beforeEach(() => {
    callNextUp.mockReset();
    afterLineChange.mockReset();
    rpc.mockReset().mockResolvedValue({ data: { success: true, session_id: "s1", court_id: "c1" }, error: null });
  });

  it("finalize_does_not_call_next: saving a result never starts the next game", async () => {
    const { finalizeMatch } = await import("@/features/matches/api/matchActions");
    const res = await finalizeMatch("00000000-0000-4000-8000-000000000001", 11, 5);
    expect(res, JSON.stringify(res)).toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("finish_match");
    expect(callNextUp).not.toHaveBeenCalled();
    expect(afterLineChange).toHaveBeenCalledWith("s1", ["/courts/c1/monitor"]);
  });
});
