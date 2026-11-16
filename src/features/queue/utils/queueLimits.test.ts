import { describe, expect, it } from "vitest";
import { canRejoin, canTakeBreak, leaveIsFinal } from "./queueLimits";

describe("queue limits", () => {
  it("allows one break per session", () => {
    expect(canTakeBreak({ breaksTaken: 0, timesLeft: 0 })).toBe(true);
    expect(canTakeBreak({ breaksTaken: 1, timesLeft: 0 })).toBe(false);
  });

  it("lets a player come back once after leaving", () => {
    expect(canRejoin({ breaksTaken: 0, timesLeft: 0 })).toBe(true);
    expect(canRejoin({ breaksTaken: 0, timesLeft: 1 })).toBe(true);
    expect(canRejoin({ breaksTaken: 0, timesLeft: 2 })).toBe(false);
  });

  it("warns that a second leave is for good", () => {
    expect(leaveIsFinal({ breaksTaken: 0, timesLeft: 0 })).toBe(false);
    expect(leaveIsFinal({ breaksTaken: 0, timesLeft: 1 })).toBe(true);
  });
});
