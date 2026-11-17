import { describe, it, expect } from "vitest";
import { withLineRetry } from "@/features/queue/utils/lineRetry";
import { LINE_STATUSES, isInLine } from "@/features/queue/constants/queueStatuses";

describe("withLineRetry", () => {
  it("retries once, then returns the second result", async () => {
    let n = 0;
    expect(await withLineRetry(async () => ++n, (r) => r < 5)).toBe(2);
  });

  it("stops as soon as no retry is needed", async () => {
    let n = 0;
    expect(await withLineRetry(async () => ++n, () => false)).toBe(1);
  });
});

describe("queue statuses", () => {
  it("in line means waiting, called or on a break; playing and left are out of it", () => {
    expect([...LINE_STATUSES]).toEqual(["waiting", "called", "on_break"]);
    expect(isInLine("on_break")).toBe(true);
    expect(isInLine("playing")).toBe(false);
    expect(isInLine("left")).toBe(false);
  });
});
