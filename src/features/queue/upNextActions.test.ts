import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/security/authGuard", () => ({ requireAdminUser: async () => ({ context: { userId: "admin-1" } }) }));
vi.mock("@/features/activity/server/logEvent", () => ({ recordSessionEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc,
    // refreshUpNext reads the session; an inactive one stops it early.
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "completed" } }) }) }) }),
  }),
}));

describe("saveUpNextCard", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { card_id: "k1", unpaired: [] }, error: null }));

  it("keeps a court-bound card on its court when edited", async () => {
    const { saveUpNextCard } = await import("@/features/queue/api/upNextActions");
    await saveUpNextCard("s1", "k1", ["a"], ["b"], "court-3");
    expect(rpc).toHaveBeenCalledWith("save_up_next_card", expect.objectContaining({ p_target_court_id: "court-3" }));
  });
});
