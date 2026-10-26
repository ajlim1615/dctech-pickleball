import { describe, it, expect } from "vitest";
import { courtControls, courtPill } from "./courtStatus";
import type { DeskGame } from "../engine/types";

const NOW = Date.parse("2026-10-21T19:30:00.000Z");
const game = (minutesAgo: number): DeskGame => ({
  id: "g1",
  sessionId: "s1",
  courtId: "c1",
  teamA: ["p1", "p2"],
  teamB: ["p3", "p4"],
  winner: null,
  startedAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
});

describe("courtPill", () => {
  it("shows live minutes for a game in progress", () => {
    expect(courtPill({ id: "c1", name: "Court 1", closed: false }, game(12), undefined, NOW)).toEqual({
      label: "12 min",
      tone: "live",
      minutes: 12,
    });
  });

  it("warns when a court closes after its game", () => {
    expect(courtPill({ id: "c1", name: "Court 1", closed: true }, game(3), undefined, NOW)).toEqual({
      label: "Closing after this game",
      tone: "warn",
    });
  });

  it("says closed for an empty closed court", () => {
    expect(courtPill({ id: "c1", name: "Court 1", closed: true }, undefined, undefined, NOW)).toEqual({
      label: "Closed",
      tone: "neutral",
    });
  });

  it("says up next for a suggested four", () => {
    const teams = { teamA: ["p1", "p2"], teamB: ["p3", "p4"] };
    expect(courtPill({ id: "c1", name: "Court 1", closed: false }, undefined, teams, NOW)).toEqual({
      label: "Up next",
      tone: "neutral",
    });
  });

  it("says how many more players are needed", () => {
    expect(courtPill({ id: "c1", name: "Court 1", closed: false }, undefined, { waitingFor: 2 }, NOW)).toEqual({
      label: "Needs 2 more",
      tone: "neutral",
    });
  });

  it("says when a skill match is holding the court", () => {
    expect(courtPill({ id: "c1", name: "Court 1", closed: false }, undefined, { hold: "no_skill_match" }, NOW)).toEqual({
      label: "Waiting for a skill match",
      tone: "warn",
    });
  });
});

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
