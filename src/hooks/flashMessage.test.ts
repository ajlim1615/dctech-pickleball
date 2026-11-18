import { describe, expect, it } from "vitest";
import { flashClearsAfter } from "./useFlashMessage";

describe("flashClearsAfter", () => {
  it("success flashes clear after 4 s", () => {
    expect(flashClearsAfter("success")).toBe(4000);
  });

  it("errors stay", () => {
    expect(flashClearsAfter("error")).toBeNull();
  });
});
