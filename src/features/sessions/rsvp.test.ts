import { describe, it, expect } from "vitest";
import { canRsvp } from "@/features/sessions/utils/rsvp";

describe("canRsvp", () => {
  it("is open only for scheduled sessions", () => {
    expect(canRsvp("scheduled")).toBe(true);
    expect(canRsvp("active")).toBe(false);
    expect(canRsvp("completed")).toBe(false);
    expect(canRsvp("cancelled")).toBe(false);
  });
});
