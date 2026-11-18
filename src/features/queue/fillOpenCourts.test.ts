import { describe, it, expect, vi } from "vitest";

const sendUpNextToCourt = vi.fn(async () => ({ success: true as const, matchId: "m" }));
const refreshUpNext = vi.fn(async () => {});
const card = (id: string, position: number) => ({
  id,
  position,
  perSide: 2,
  targetCourtId: null,
  isAuto: true,
  teamA: [`${id}a1`, `${id}a2`],
  teamB: [`${id}b1`, `${id}b2`],
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/security/authGuard", () => ({
  requireAdminUser: async () => ({ context: { userId: "admin-1" } }),
  isRootSystemAdmin: () => false,
}));
vi.mock("@/features/queue/api/upNextActions", () => ({
  getUpNext: async () => [card("u1", 1), card("u2", 2), card("u3", 3)],
  sendUpNextToCourt,
  refreshUpNext,
}));
vi.mock("@/features/courts/api/courtPlayerActions", () => ({ markNoShow: vi.fn() }));
vi.mock("@/features/queue/server/afterLineChange", () => ({ afterLineChange: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ order: async () => ({ data: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] }) }),
        }),
      }),
    }),
  }),
}));

describe("fillOpenCourts", () => {
  it("starts a card on every open court, refreshing the cards once at the end", async () => {
    const { fillOpenCourts } = await import("@/features/queue/api/queueActions");
    const res = await fillOpenCourts("s1");
    expect(res).toMatchObject({ success: true, filled: 3 });
    expect(sendUpNextToCourt.mock.calls).toEqual([
      ["s1", "u1", "c1", { refresh: false }],
      ["s1", "u2", "c2", { refresh: false }],
      ["s1", "u3", "c3", { refresh: false }],
    ]);
    expect(refreshUpNext).toHaveBeenCalledTimes(1);
  });
});
