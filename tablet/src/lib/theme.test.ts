import { describe, it, expect, vi } from "vitest";

vi.mock("../db/repo", () => ({
  getMeta: vi.fn(() => Promise.reject(new Error("storage unavailable"))),
  setMeta: vi.fn(() => Promise.resolve()),
}));

import { loadTheme, parseTheme } from "./theme";

describe("theme", () => {
  it("parseTheme defaults to light for missing or unknown values", () => {
    for (const raw of [undefined, "", "blue", 42]) expect(parseTheme(raw)).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("loadTheme falls back to light when storage throws", async () => {
    expect(await loadTheme()).toBe("light");
  });
});
