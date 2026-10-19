import { describe, it, expect } from "vitest";
import { selectPlayersToRequeue } from "@/features/queue/utils/requeue";

describe("selectPlayersToRequeue", () => {
  it("sends every checked-in player from the match to the back of the queue", () => {
    const result = selectPlayersToRequeue({
      matchPlayerIds: ["p1", "p2", "p3", "p4"],
      checkedInIds: ["p1", "p2", "p3", "p4"],
      activeQueueIds: [],
    });
    expect(result.map((e) => e.player_id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("skips players who checked out or are already queued", () => {
    const result = selectPlayersToRequeue({
      matchPlayerIds: ["p1", "p2", "p3", "p4"],
      checkedInIds: ["p1", "p2", "p4"],
      activeQueueIds: ["p4"],
    });
    expect(result.map((e) => e.player_id)).toEqual(["p1", "p2"]);
  });

  it("keeps a doubles pair bonded only when both partners rejoin", () => {
    const result = selectPlayersToRequeue({
      matchPlayerIds: ["p1", "p2", "p3", "p4"],
      checkedInIds: ["p1", "p2", "p3"],
      activeQueueIds: [],
      previousGroupIds: { p1: "g1", p2: "g1", p3: "g2", p4: "g2" },
    });
    expect(result).toEqual([
      { player_id: "p1", group_id: "g1" },
      { player_id: "p2", group_id: "g1" },
      { player_id: "p3", group_id: null },
    ]);
  });
});
