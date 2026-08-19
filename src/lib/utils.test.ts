import { describe, it, expect } from "vitest";
import { formatRating, formatScore, cn } from "./utils";

describe("utils", () => {
  it("formats rating properly", () => {
    expect(formatRating(3.5)).toBe("3.50");
    expect(formatRating("4.123")).toBe("4.12");
    expect(formatRating(null)).toBe("3.00");
  });

  it("formats match score properly", () => {
    expect(formatScore(11, 9)).toBe("11 - 9");
  });

  it("merges class names correctly", () => {
    expect(cn("bg-red-500", "p-4", false && "hidden")).toBe("bg-red-500 p-4");
  });
});
