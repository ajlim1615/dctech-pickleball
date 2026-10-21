import { describe, it, expect } from "vitest";
import { courtControls } from "./courtStatus";

const court = (closed: boolean) => ({ id: "c1", name: "Court 1", closed });

describe("courtControls", () => {
  it("an open court offers Close court", () => {
    expect(courtControls(court(false), true)).toEqual({ toggleLabel: "Close court", notice: null });
  });

  it("a closed court with a game running says it closes after the game and offers Reopen", () => {
    expect(courtControls(court(true), true)).toEqual({ toggleLabel: "Reopen", notice: "Closing after this game" });
  });

  it("a closed empty court offers Reopen", () => {
    expect(courtControls(court(true), false)).toEqual({ toggleLabel: "Reopen", notice: "Closed" });
  });
});
