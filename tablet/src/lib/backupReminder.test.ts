import { describe, it, expect } from "vitest";
import { backupReminder } from "./backupReminder";

const now = new Date("2026-10-21T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("backupReminder", () => {
  it("says nothing on an empty tablet", () => {
    expect(backupReminder(undefined, false, now)).toBeNull();
  });

  it("asks for a first backup once there is data", () => {
    expect(backupReminder(undefined, true, now)).toMatch(/No backup yet/);
  });

  it("stays quiet for 14 days", () => {
    expect(backupReminder(daysAgo(14), true, now)).toBeNull();
  });

  it("reminds after 14 days in weeks", () => {
    expect(backupReminder(daysAgo(21), true, now)).toBe("Last backup: 3 weeks ago.");
  });
});
