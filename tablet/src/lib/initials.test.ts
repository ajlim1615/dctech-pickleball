import { describe, it, expect } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("takes the first letters of the first and last words", () => {
    expect(initials("Ana Cruz")).toBe("AC");
    expect(initials("  maria  de la cruz ")).toBe("MC");
  });

  it("uses the first two letters of a single name", () => {
    expect(initials("Cher")).toBe("CH");
    expect(initials("A".repeat(40))).toHaveLength(2);
  });

  it("keeps accented letters", () => {
    expect(initials("Ñoño Ibáñez")).toBe("ÑI");
  });

  it("falls back to ? for an empty name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
