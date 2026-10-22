import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TOKENS, type TokenName } from "./tokens";
import { contrastRatio, mix } from "./contrast";

const themes = ["light", "dark"] as const;

describe("design tokens", () => {
  it("contrastRatio of black on white is 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("body text meets AA in both themes", () => {
    const pairs: [TokenName, TokenName][] = [
      ["ink", "bg"],
      ["ink", "surface"],
      ["ink", "sunken"],
      ["muted", "bg"],
      ["muted", "surface"],
      ["on-primary", "primary"],
      ["t1", "t1-bg"],
      ["t2", "t2-bg"],
      ["clay", "clay-bg"],
    ];
    for (const theme of themes) {
      for (const [fg, bg] of pairs) {
        const ratio = contrastRatio(TOKENS[theme][fg], TOKENS[theme][bg]);
        expect(ratio, `${theme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("team names stay readable on the court", () => {
    for (const theme of themes) {
      expect(contrastRatio(TOKENS[theme].t1, TOKENS[theme].court), `${theme} t1`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(TOKENS[theme].t2, TOKENS[theme].court), `${theme} t2`).toBeGreaterThanOrEqual(3);
    }
  });

  it("muted text stays readable on the side panel and the court tints", () => {
    for (const theme of themes) {
      const t = TOKENS[theme];
      // Court halves are the team tint at 70% over the court colour (CourtCard).
      const tintA = mix(t["t1-bg"], t.court, 0.7);
      const tintB = mix(t["t2-bg"], t.court, 0.7);
      expect(contrastRatio(t.muted, t.sunken), `${theme} muted on sunken`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.muted, tintA), `${theme} muted on team 1 tint`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.muted, tintB), `${theme} muted on team 2 tint`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("styles.css defines every token value", () => {
    const css = readFileSync(path.resolve(__dirname, "../styles.css"), "utf8").toLowerCase();
    for (const theme of themes) {
      for (const [name, value] of Object.entries(TOKENS[theme])) {
        expect(css, `${theme} --${name}`).toContain(`--${name}: ${value.toLowerCase()}`);
      }
    }
  });
});
