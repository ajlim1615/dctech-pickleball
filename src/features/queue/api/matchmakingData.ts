import type { createClient } from "@/lib/supabase/server";
import type { Decision, PastGame, Teams } from "@/features/queue/matchmaking";

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
  const { data } = await supabase
    .from("matches")
    .select("court_id, status, winning_team, ended_at, players:match_players ( player_id, team )")
    .eq("session_id", sessionId)
    .eq("status", "completed");
  return pastGamesFromMatches((data ?? []) as unknown as MatchRowForHistory[]);
}

/** Every court in ladder order, in use or not, except those closed for maintenance. */
export async function loadOpenCourtIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("courts")
    .select("id")
    .neq("status", "maintenance")
    .order("sort_order", { ascending: true });
  return (data ?? []).map((c) => c.id);
}

export function holdMessage(d: Exclude<Decision, Teams>, skillSpread: number): string {
  if (d.hold === "not_enough_players") {
    return `Need ${d.needed} more waiting player${d.needed === 1 ? "" : "s"} to start a game.`;
  }
  return `No group of four within ${skillSpread} rating of each other yet.`;
}
