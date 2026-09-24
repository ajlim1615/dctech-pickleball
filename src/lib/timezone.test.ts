import { describe, it, expect } from "vitest";
import {
  parsePHTToISO,
  toPHTDateTimeLocal,
  formatPHTTime,
  formatPHTDate,
  formatPHTDateTime,
  formatPHTFull,
  formatPHTClock,
  getPHTTodayString,
  PHILIPPINES_TIMEZONE,
} from "./timezone";

describe("Philippine Timezone Utilities", () => {
  it("should have Asia/Manila as constant timezone", () => {
    expect(PHILIPPINES_TIMEZONE).toBe("Asia/Manila");
  });

  it("parses local datetime string as Philippine Time (UTC+8)", () => {
    // 6:00 PM on Sept 24 Manila time = 10:00 AM UTC on Sept 24
    const iso = parsePHTToISO("2026-09-24T18:00");
    expect(iso).toBe("2026-09-24T10:00:00.000Z");

    // 2:00 AM on Sept 25 Manila time = 6:00 PM (18:00) UTC on Sept 24
    const isoLateNight = parsePHTToISO("2026-09-25T02:00");
    expect(isoLateNight).toBe("2026-09-24T18:00:00.000Z");
  });

  it("converts UTC ISO to Philippine datetime-local string", () => {
    // 10:00 UTC = 18:00 PHT
    const local = toPHTDateTimeLocal("2026-09-24T10:00:00.000Z");
    expect(local).toBe("2026-09-24T18:00");

    // 18:00 UTC Sept 24 = 02:00 PHT Sept 25
    const localLate = toPHTDateTimeLocal("2026-09-24T18:00:00.000Z");
    expect(localLate).toBe("2026-09-25T02:00");
  });

  it("formats time accurately in PHT", () => {
    // 10:00 UTC is 6:00 PM in Manila
    const formatted = formatPHTTime("2026-09-24T10:00:00.000Z");
    expect(formatted).toBe("6:00 PM");
  });

  it("formats date accurately across midnight boundary", () => {
    // 16:30 UTC on Sept 24 is 00:30 on Sept 25 in Manila
    const dateStr = formatPHTDate("2026-09-24T16:30:00.000Z");
    expect(dateStr).toContain("Sep 25");
  });

  it("formats full date-time with PHT label", () => {
    const full = formatPHTFull("2026-09-24T10:00:00.000Z");
    expect(full).toContain("Sep 24");
    expect(full).toContain("6:00 PM PHT");
  });

  it("generates correct PHT today string in YYYY-MM-DD", () => {
    // Date object at 16:00 UTC Sept 24 (Midnight Sept 25 Manila)
    const testDate = new Date("2026-09-24T16:00:00.000Z");
    expect(getPHTTodayString(testDate)).toBe("2026-09-25");
  });

  it("formats live clock with PHT tag", () => {
    const clock = formatPHTClock(new Date("2026-09-24T10:05:08.000Z"));
    expect(clock).toBe("06:05:08 PM PHT");
  });
});
