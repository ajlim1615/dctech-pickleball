import type { createClient } from "@/lib/supabase/server";
import type { Decision, LineEntry, PastGame, Teams } from "@/features/queue/matchmaking";
import { kingQueenPlacements } from "@/features/queue/matchmaking/history";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface MatchRowForHistory {
  court_id: string;
  status: string;
  winning_team: "team_a" | "team_b" | "tie" | null;
  ended_at: string | null;
  players?: { team: "team_a" | "team_b"; player_id?: string; player?: { id: string } | null }[] | null;
}

/** Completed games with an end time, oldest first. Ties and unscored games have no winner. */
export function pastGamesFromMatches(rows: MatchRowForHistory[]): PastGame[] {
  const games: PastGame[] = [];
  for (const row of rows) {
    if (row.status !== "completed" || !row.ended_at) continue;
    const teamA: string[] = [];
    const teamB: string[] = [];
    for (const p of row.players ?? []) {
      const id = p.player_id ?? p.player?.id;
      if (!id) continue;
      (p.team === "team_a" ? teamA : teamB).push(id);
    }
    games.push({
      courtId: row.court_id,
      teamA,
      teamB,
      winner: row.winning_team === "team_a" ? "A" : row.winning_team === "team_b" ? "B" : null,
      endedAt: row.ended_at,
    });
  }
  return games.sort((a, b) => (a.endedAt < b.endedAt ? -1 : a.endedAt > b.endedAt ? 1 : 0));
}

/** This session's completed matches, as the matchmaker's history. */
export async function loadSessionHistory(supabase: SupabaseClient, sessionId: string): Promise<PastGame[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("court_id, status, winning_team, ended_at, players:match_players ( player_id, team )")
    .eq("session_id", sessionId)
    .eq("status", "completed");
  if (error) console.error("loadSessionHistory failed:", error);
  return pastGamesFromMatches((data ?? []) as unknown as MatchRowForHistory[]);
}

/** Every court in ladder order, in use or not, except those closed for maintenance. */
export async function loadOpenCourtIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("courts")
    .select("id")
    .neq("status", "maintenance")
    .order("sort_order", { ascending: true });
  if (error) console.error("loadOpenCourtIds failed:", error);
  return (data ?? []).map((c) => c.id);
}

/** King/Queen: waiting players held for courts ranked above `court`, so they can't play on it. */
export function reservedAbove(history: PastGame[], line: LineEntry[], courts: string[], court: string): number {
  const rank = courts.indexOf(court);
  if (rank <= 0) return 0;
  let count = 0;
  for (const [courtId, placed] of kingQueenPlacements(history, line, courts)) {
    if (courts.indexOf(courtId) >= rank) continue;
    count += (placed.staying ? 2 : 0) + (placed.promoted ? 2 : 0);
  }
  return count;
}

export function holdMessage(d: Exclude<Decision, Teams>, skillSpread: number, reserved = 0): string {
  if (d.hold === "not_enough_players") {
    const base = `Need ${d.needed} more waiting player${d.needed === 1 ? "" : "s"} to start a game.`;
    return reserved > 0 ? `${base} (${reserved} waiting player${reserved === 1 ? " is" : "s are"} saved for a court above.)` : base;
  }
  return `No group of four within ${skillSpread} rating of each other yet.`;
}

/**
 * Which court the "Up next" preview is for, and every open court (maintenance excluded) in ladder order.
 * The court is the first one with no game in progress, else the first open court.
 */
export function previewCourtId(
  courts: { id: string; status: string; sort_order: number; current_match_id: string | null }[]
): { court: string; courts: string[] } | null {
  const open = courts.filter((c) => c.status !== "maintenance").sort((a, b) => a.sort_order - b.sort_order);
  if (open.length === 0) return null;
  const court = (open.find((c) => !c.current_match_id) ?? open[0]).id;
  return { court, courts: open.map((c) => c.id) };
}
