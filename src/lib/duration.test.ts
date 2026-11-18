import { describe, expect, it } from "vitest";
import { formatClockDuration, formatMatchDuration } from "./duration";

describe("formatClockDuration", () => {
  const base = Date.parse("2026-11-18T12:00:00.000Z");

  it("formats durations under 1 minute as 00:SS", () => {
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base)).toBe("00:00");
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + 42_000)).toBe("00:42");
  });

  it("formats durations under 1 hour as MM:SS", () => {
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (6 * 60 + 15) * 1000)).toBe("06:15");
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (59 * 60 + 59) * 1000)).toBe("59:59");
  });

  it("formats durations at 1 hour or more as H:MM:SS", () => {
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (3600 + 5 * 60 + 12) * 1000)).toBe("1:05:12");
    expect(formatClockDuration("2026-11-18T12:00:00.000Z", base + (2 * 3600) * 1000)).toBe("2:00:00");
  });

  it("clamps negative clock skew and invalid timestamps to 00:00", () => {
    expect(formatClockDuration("2026-11-18T12:05:00.000Z", base)).toBe("00:00");
    expect(formatClockDuration("not-a-date", base)).toBe("00:00");
  });
});

describe("formatMatchDuration", () => {
  const start = "2026-11-18T12:00:00.000Z";

  it("formats sub-minute durations as Xs", () => {
    expect(formatMatchDuration(start, "2026-11-18T12:00:45.000Z")).toBe("45s");
    expect(formatMatchDuration(start, "2026-11-18T12:00:01.000Z")).toBe("1s");
  });

  it("formats under-1-hour durations as Xm Ys or Xm when seconds are 0", () => {
    expect(formatMatchDuration(start, "2026-11-18T12:12:34.000Z")).toBe("12m 34s");
    expect(formatMatchDuration(start, "2026-11-18T12:06:00.000Z")).toBe("6m");
  });

  it("formats 1-hour+ durations as Xh Ym or Xh when minutes are 0", () => {
    expect(formatMatchDuration(start, "2026-11-18T13:05:40.000Z")).toBe("1h 5m");
    expect(formatMatchDuration(start, "2026-11-18T13:00:15.000Z")).toBe("1h");
  });

  it("returns null for missing, invalid, zero-length, or reversed timestamps", () => {
    expect(formatMatchDuration(null, "2026-11-18T12:10:00.000Z")).toBeNull();
    expect(formatMatchDuration(start, null)).toBeNull();
    expect(formatMatchDuration(undefined, undefined)).toBeNull();
    expect(formatMatchDuration("invalid", "2026-11-18T12:10:00.000Z")).toBeNull();
    expect(formatMatchDuration(start, start)).toBeNull();
    expect(formatMatchDuration("2026-11-18T12:10:00.000Z", start)).toBeNull();
  });

  it("handles Supabase timezone offsets (+00:00 vs Z)", () => {
    expect(formatMatchDuration("2026-11-18T12:00:00+00:00", "2026-11-18T12:11:05.500Z")).toBe("11m 5s");
  });
});
