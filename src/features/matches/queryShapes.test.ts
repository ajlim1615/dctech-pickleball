import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MATCH_COURT } from "./utils/queryShapes";

const COURT_EMBED_FILES = [
  "src/features/courts/api/courtPlayerActions.ts",
  "src/features/matches/api/matchActions.ts",
  "src/features/sessions/api/sessionActions.ts",
  "src/features/sessions/api/sessionExportActions.ts",
];

describe("MATCH_COURT", () => {
  it("names the court_id key", () => {
    expect(MATCH_COURT).toBe("court:courts!court_id");
  });

  it("every matches select that embeds courts uses MATCH_COURT", () => {
    for (const rel of COURT_EMBED_FILES) {
      const source = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(source, `${rel} should import MATCH_COURT`).toContain("MATCH_COURT");
      expect(source, `${rel} should not hardcode courts!court_id`).not.toContain("courts!court_id");
      expect(source, `${rel} should not use ambiguous court:courts (`).not.toContain("court:courts (");
    }
  });
});
