import { describe, expect, it } from "vitest";
import { MATCH_COURT } from "./utils/queryShapes";

describe("MATCH_COURT", () => {
  it("names the court_id key", () => {
    expect(MATCH_COURT).toBe("court:courts!court_id");
  });
});
