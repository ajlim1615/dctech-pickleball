import { describe, expect, it } from "vitest";
import { blockedFromSession, canEnterSession } from "./guestRules";

const employee = { is_guest: false, email: "ana@dctechmicro.com" };
const guest = { is_guest: true, email: "guest_1@dctechmicro.local" };
const unregisteredEmployee = { is_guest: false, email: "guest_2@dctechmicro.local" };

describe("guest rules", () => {
  it("lets everyone into casual sessions", () => {
    expect(canEnterSession(employee, false)).toBe(true);
    expect(canEnterSession(guest, false)).toBe(true);
  });

  it("keeps guests out of ranked sessions", () => {
    expect(canEnterSession(employee, true)).toBe(true);
    expect(canEnterSession(guest, true)).toBe(false);
  });

  it("goes by the guest flag, not the placeholder email", () => {
    expect(canEnterSession(unregisteredEmployee, true)).toBe(true);
  });

  it("lists who is blocked", () => {
    expect(blockedFromSession([employee, guest, unregisteredEmployee], true)).toEqual([guest]);
    expect(blockedFromSession([employee, guest], false)).toEqual([]);
  });
});
