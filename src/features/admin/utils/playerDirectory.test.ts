import { describe, it, expect } from "vitest";
import { isGuestProfile } from "./playerDirectory";

describe("isGuestProfile", () => {
  it("returns true when is_guest is explicitly true", () => {
    expect(isGuestProfile({ is_guest: true, email: "someone@example.com" })).toBe(true);
  });

  it("returns false when is_guest is explicitly false even with a generated local email", () => {
    expect(
      isGuestProfile({ is_guest: false, email: "guest_123@dctechmicro.local" })
    ).toBe(false);
  });

  it("falls back to legacy guest email pattern only when is_guest is undefined", () => {
    expect(isGuestProfile({ email: "guest_abc@dctechmicro.local" })).toBe(true);
    expect(isGuestProfile({ email: "employee@dctechmicro.com" })).toBe(false);
    expect(isGuestProfile({})).toBe(false);
  });
});
