import { computeSessionLeaderboard } from "./sessionLeaderboard";
import { cleanSessionDescription, parseSessionMetadata } from "@/lib/utils";
import { formatPHTDate, formatPHTTime } from "@/lib/timezone";

/** One person in the export: from a check-in, an RSVP or a game. */
export interface ExportPerson {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  employee_no: string | number | null;
}

export interface ExportInput {
  session: {
    title: string;
    description: string | null;
    location: string | null;
    start_time: string;
    end_time: string;
    status: string;
  };
  /** Every match in the session; only completed ones are counted. */
  matches: {
    id: string;
    status: string;
    team_a_score: number | null;
    team_b_score: number | null;
    winning_team: string | null;
    started_at: string | null;
    ended_at: string | null;
    court_name: string | null;
    players: { player_id: string; team: string }[];
  }[];
  /** Every check-in row, checked out ones included. */
  checkins: { player_id: string; status: string; checkin_time: string | null }[];
  rsvps: { player_id: string }[];
  /** Rating history rows for this session's games. */
  ratingHistory: { player_id: string; match_id: string | null; old_rating: number; new_rating: number; recorded_at: string }[];
  people: ExportPerson[];
}

export type Row = Record<string, string | number>;

export interface SessionExport {
  fileName: string;
  sheets: { name: string; rows: Row[] }[];
}

const SYSTEM_ADMIN = "admin@dctechmicro.com";

function nameOf(p?: ExportPerson) {
  return p?.full_name || p?.display_name || "Player";
}

function time(iso: string | null | undefined) {
  return iso ? formatPHTTime(iso) : "";
}

function safeFilePart(text: string) {
  return text.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Session";
}

/**
 * Builds the after-session export: a summary, the session leaderboard, attendance
 * (who said they were going, came, and how many games they played) and every game.
 */
export function buildSessionExport(input: ExportInput): SessionExport {
  const meta = parseSessionMetadata(input.session.description);
  const people = new Map(
    input.people.filter((p) => p.email?.toLowerCase() !== SYSTEM_ADMIN).map((p) => [p.id, p])
  );
  const isPlayer = (id: string) => people.has(id);

  const completed = input.matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => (a.ended_at ?? "").localeCompare(b.ended_at ?? ""));

  // Session standings: same order as the leaderboard on the session page.
  const standings = computeSessionLeaderboard(
    completed.map((m) => ({
      ...m,
      players: m.players.filter((mp) => isPlayer(mp.player_id)).map((mp) => ({
        team: mp.team,
        player: { id: mp.player_id, full_name: nameOf(people.get(mp.player_id)) },
      })),
    })),
    []
  );

  // Rating before the first game and after the last game, from this session's history.
  const ratingSpan = new Map<string, { before: number; after: number }>();
  for (const h of [...input.ratingHistory].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))) {
    if (!h.match_id) continue;
    const span = ratingSpan.get(h.player_id);
    if (span) span.after = Number(h.new_rating);
    else ratingSpan.set(h.player_id, { before: Number(h.old_rating), after: Number(h.new_rating) });
  }

  const leaderboard: Row[] = standings.map((s) => {
    const person = people.get(s.id);
    const row: Row = {
      Rank: s.rank,
      Player: nameOf(person),
      "Employee No.": person?.employee_no ?? "",
      Games: s.games_played,
      Wins: s.games_won,
      Losses: s.games_lost,
      "Win rate (%)": s.win_rate,
    };
    if (meta.trackScores) {
      row["Points won"] = s.points_scored;
      row["Points lost"] = s.points_conceded;
      row["Point diff"] = s.point_diff;
    }
    if (meta.isRanked) {
      const span = ratingSpan.get(s.id);
      row["Rating before"] = span ? span.before.toFixed(2) : "";
      row["Rating after"] = span ? span.after.toFixed(2) : "";
      row["Rating change"] = span ? (span.after - span.before >= 0 ? "+" : "") + (span.after - span.before).toFixed(2) : "";
    }
    return row;
  });

  // Attendance: everyone who said they were going, checked in, or played.
  const gamesBy = new Map(standings.map((s) => [s.id, s.games_played]));
  const checkinBy = new Map(input.checkins.map((c) => [c.player_id, c]));
  const going = new Set(input.rsvps.map((r) => r.player_id));
  const ids = new Set<string>([...going, ...checkinBy.keys(), ...gamesBy.keys()]);
  const attendance: Row[] = [...ids]
    .filter(isPlayer)
    .map((id) => {
      const person = people.get(id)!;
      const checkin = checkinBy.get(id);
      const games = gamesBy.get(id) ?? 0;
      const came = Boolean(checkin) || games > 0;
      return {
        Player: nameOf(person),
        "Employee No.": person.employee_no ?? "",
        Email: person.email ?? "",
        "Said going": going.has(id) ? "Yes" : "No",
        "Checked in": checkin?.checkin_time ? time(checkin.checkin_time) : came ? "Yes" : "",
        "Checked out": checkin?.status === "checked_out" ? "Yes" : "",
        Games: games,
        Attendance: games > 0 ? "Played" : came ? "Came, no games" : "No-show",
      };
    })
    .sort((a, b) => String(a.Player).localeCompare(String(b.Player)));

  const games: Row[] = completed.map((m, i) => {
    const team = (t: string) =>
      m.players.filter((p) => p.team === t && isPlayer(p.player_id)).map((p) => nameOf(people.get(p.player_id))).join(" & ");
    const winner = m.winning_team === "team_a" ? "Team A" : m.winning_team === "team_b" ? "Team B" : "";
    return {
      Game: i + 1,
      Court: (m.court_name ?? "").replace(/\s*\(Rented Court\)/i, ""),
      Started: time(m.started_at),
      Ended: time(m.ended_at),
      "Team A": team("team_a"),
      "Team B": team("team_b"),
      Score: meta.trackScores ? `${m.team_a_score ?? 0} - ${m.team_b_score ?? 0}` : "Win/loss only",
      Winner: winner,
    };
  });

  const playedCount = standings.filter((s) => s.games_played > 0).length;
  const cameCount = attendance.filter((a) => a.Attendance !== "No-show").length;
  const summary: Row[] = [
    { Item: "Session", Value: input.session.title },
    { Item: "Date", Value: formatPHTDate(input.session.start_time) },
    { Item: "Time", Value: `${time(input.session.start_time)} - ${time(input.session.end_time)}` },
    { Item: "Location", Value: input.session.location ?? "" },
    { Item: "Notes", Value: cleanSessionDescription(input.session.description) },
    { Item: "Type", Value: meta.isRanked ? "Ranked" : "Casual" },
    { Item: "Courts", Value: meta.courtCount ?? "" },
    { Item: "Said going", Value: going.size },
    { Item: "Came", Value: cameCount },
    { Item: "Played at least one game", Value: playedCount },
    { Item: "No-shows", Value: attendance.length - cameCount },
    { Item: "Games played", Value: completed.length },
  ];

  const datePart = formatPHTDate(input.session.start_time).replace(/[^\w]+/g, "-");
  return {
    fileName: `${safeFilePart(input.session.title)}_${datePart}.xlsx`,
    sheets: [
      { name: "Summary", rows: summary },
      { name: "Leaderboard", rows: leaderboard },
      { name: "Attendance", rows: attendance },
      { name: "Games", rows: games },
    ],
  };
}
