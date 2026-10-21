import * as XLSX from "xlsx";
import { formatMatchScore } from "@/features/matches/utils/scoring";
import { sessionLeaderboard } from "../engine/leaderboard";
import type { DeskSession, SessionState } from "../engine/types";

type Row = (string | number)[];

function clock(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The two sheets of a session export, header row first. */
export function exportRows(state: SessionState): { leaderboard: Row[]; games: Row[] } {
  const { trackScores } = state.session;
  const name = (id: string) => state.players[id]?.name ?? "Player";
  const courtName = (id: string) => state.session.courts.find((c) => c.id === id)?.name ?? "Court";

  const leaderboard: Row[] = [
    trackScores
      ? ["Rank", "Player", "Played", "Won", "Lost", "Points for", "Points against", "Diff"]
      : ["Rank", "Player", "Played", "Won", "Lost"],
    ...sessionLeaderboard(state).map((r) => {
      const base: Row = [r.rank, r.display_name, r.games_played, r.games_won, r.games_lost];
      return trackScores ? [...base, r.points_scored, r.points_conceded, r.point_diff] : base;
    }),
  ];

  const finished = state.games
    .filter((g) => g.endedAt && g.winner)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const games: Row[] = [
    ["#", "Court", "Team 1", "Team 2", "Score", "Winner", "Started", "Ended"],
    ...finished.map((g, i) => [
      i + 1,
      courtName(g.courtId),
      g.teamA.map(name).join(" & "),
      g.teamB.map(name).join(" & "),
      trackScores ? formatMatchScore(g.scoreA, g.scoreB) : "Win/loss only",
      g.winner === "A" ? "Team 1" : "Team 2",
      clock(g.startedAt),
      clock(g.endedAt),
    ]),
  ];

  return { leaderboard, games };
}

export function exportFileName(session: DeskSession): string {
  const title = session.title.replace(/[\\/:*?"<>|]/g, "-").trim() || "Session";
  return `Pickleball – ${title} – ${session.date}.xlsx`;
}

export function buildWorkbook(state: SessionState): Uint8Array {
  const rows = exportRows(state);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows.leaderboard), "Leaderboard");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows.games), "Games");
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
