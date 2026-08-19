import { describe, it, expect } from "vitest";

describe("Queue Logic", () => {
  it("calculates estimated wait time correctly based on queue position", () => {
    const calcWait = (position: number, avgGameMins: number = 12, courts: number = 4) => {
      const rotationCycles = Math.ceil(position / (courts * 4));
      return rotationCycles * avgGameMins;
    };

    expect(calcWait(1)).toBe(12);
    expect(calcWait(4)).toBe(12);
    expect(calcWait(17)).toBe(24);
  });

  it("handles doubles pairing grouped entries", () => {
    const queue = [
      { id: "q1", player_id: "p1", group_id: "group-1" },
      { id: "q2", player_id: "p2", group_id: "group-1" },
      { id: "q3", player_id: "p3", group_id: null },
    ];

    const paired = queue.filter((q) => q.group_id === "group-1");
    expect(paired.length).toBe(2);
    expect(paired[0].player_id).toBe("p1");
    expect(paired[1].player_id).toBe("p2");
  });
});
