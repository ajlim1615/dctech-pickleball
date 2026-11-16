import { describe, expect, it } from "vitest";
import { buildSessionExport, type ExportInput } from "./sessionExport";

const person = (id: string, name: string, employee_no: string | null = null) => ({
  id,
  full_name: name,
  display_name: null,
  email: `${id}@x.com`,
  employee_no,
});

function input(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    session: {
      title: "DC TECH Sports Day",
      description: "Fun day [ranked:true] [scoring:points] [courts:3]",
      location: "Arena",
      start_time: "2026-11-20T09:00:00Z",
      end_time: "2026-11-20T12:00:00Z",
      status: "completed",
    },
    matches: [
      {
        id: "m1",
        status: "completed",
        team_a_score: 11,
        team_b_score: 5,
        winning_team: "team_a",
        started_at: "2026-11-20T09:10:00Z",
        ended_at: "2026-11-20T09:25:00Z",
        court_name: "Court 1 (Rented Court)",
        players: [
          { player_id: "a", team: "team_a" },
          { player_id: "b", team: "team_a" },
          { player_id: "c", team: "team_b" },
          { player_id: "d", team: "team_b" },
        ],
      },
      { id: "m2", status: "in_progress", team_a_score: 0, team_b_score: 0, winning_team: null, started_at: null, ended_at: null, court_name: null, players: [{ player_id: "a", team: "team_a" }] },
    ],
    checkins: [
      { player_id: "a", status: "checked_in", checkin_time: "2026-11-20T09:00:00Z" },
      { player_id: "b", status: "checked_out", checkin_time: "2026-11-20T09:01:00Z" },
      { player_id: "c", status: "checked_in", checkin_time: "2026-11-20T09:02:00Z" },
      { player_id: "d", status: "checked_in", checkin_time: "2026-11-20T09:03:00Z" },
      { player_id: "e", status: "checked_in", checkin_time: "2026-11-20T09:04:00Z" },
    ],
    rsvps: [{ player_id: "a" }, { player_id: "f" }],
    ratingHistory: [
      { player_id: "a", match_id: "m1", old_rating: 2, new_rating: 2.2, recorded_at: "2026-11-20T09:25:00Z" },
    ],
    people: [person("a", "Ana", "1001"), person("b", "Ben"), person("c", "Cy"), person("d", "Dee"), person("e", "Eve"), person("f", "Fay")],
    ...overrides,
  };
}

const sheet = (exp: ReturnType<typeof buildSessionExport>, name: string) =>
  exp.sheets.find((s) => s.name === name)!.rows;

describe("buildSessionExport", () => {
  it("has summary, leaderboard, attendance and games sheets", () => {
    const exp = buildSessionExport(input());
    expect(exp.sheets.map((s) => s.name)).toEqual(["Summary", "Leaderboard", "Attendance", "Games"]);
    expect(exp.fileName).toMatch(/^DC_TECH_Sports_Day_.*\.xlsx$/);
  });

  it("counts only finished games on the leaderboard, with rating change for ranked sessions", () => {
    const rows = sheet(buildSessionExport(input()), "Leaderboard");
    const ana = rows.find((r) => r.Player === "Ana")!;
    expect(ana).toMatchObject({ Games: 1, Wins: 1, Losses: 0, "Employee No.": "1001", "Rating change": "+0.20" });
    expect(rows).toHaveLength(4);
  });

  it("marks who played, who came without playing, and who said going but never came", () => {
    const rows = sheet(buildSessionExport(input()), "Attendance");
    const by = Object.fromEntries(rows.map((r) => [r.Player, r]));
    expect(by.Ana).toMatchObject({ Attendance: "Played", Games: 1, "Said going": "Yes" });
    expect(by.Ben).toMatchObject({ Attendance: "Played", "Checked out": "Yes" });
    expect(by.Eve).toMatchObject({ Attendance: "Came, no games", Games: 0 });
    expect(by.Fay).toMatchObject({ Attendance: "No-show", "Said going": "Yes" });
  });

  it("lists finished games in order with teams and score", () => {
    const rows = sheet(buildSessionExport(input()), "Games");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ Game: 1, Court: "Court 1", "Team A": "Ana & Ben", "Team B": "Cy & Dee", Score: "11 - 5", Winner: "Team A" });
  });

  it("drops score and rating columns for casual win/loss-only sessions", () => {
    const exp = buildSessionExport(
      input({ session: { ...input().session, description: "[ranked:false] [scoring:result]" } })
    );
    const ana = sheet(exp, "Leaderboard").find((r) => r.Player === "Ana")!;
    expect(ana).not.toHaveProperty("Points won");
    expect(ana).not.toHaveProperty("Rating change");
    expect(sheet(exp, "Games")[0].Score).toBe("Win/loss only");
  });
});
