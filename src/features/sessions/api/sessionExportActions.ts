"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/security/authGuard";
import { buildSessionExport, type SessionExport } from "@/features/sessions/utils/sessionExport";
import { MATCH_COURT } from "@/features/matches/utils/queryShapes";

/** Admin-only: the after-session spreadsheet (summary, leaderboard, attendance, games). */
export async function getSessionExport(sessionId: string): Promise<{ data?: SessionExport; error?: string }> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const [sessionRes, matchesRes, checkinsRes, rsvpsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("title, description, location, start_time, end_time, status")
      .eq("id", sessionId)
      .maybeSingle(),
    supabase
      .from("matches")
      .select(`id, status, team_a_score, team_b_score, winning_team, started_at, ended_at, ${MATCH_COURT} (name), players:match_players (player_id, team)`)
      .eq("session_id", sessionId),
    supabase.from("session_checkins").select("player_id, status, checkin_time").eq("session_id", sessionId),
    supabase.from("session_rsvps").select("player_id").eq("session_id", sessionId),
  ]);

  if (sessionRes.error || !sessionRes.data) return { error: "Session not found." };
  if (matchesRes.error) return { error: `Couldn't read the games: ${matchesRes.error.message}` };
  if (checkinsRes.error) return { error: `Couldn't read attendance: ${checkinsRes.error.message}` };

  const matches = (matchesRes.data ?? []).map((m) => {
    const court = m.court as { name?: string | null } | { name?: string | null }[] | null;
    return {
      id: m.id,
      status: m.status,
      team_a_score: m.team_a_score,
      team_b_score: m.team_b_score,
      winning_team: m.winning_team,
      started_at: m.started_at,
      ended_at: m.ended_at,
      court_name: (Array.isArray(court) ? court[0]?.name : court?.name) ?? null,
      // The generated types don't know this embed; getSessionMatches uses the same one.
      players: ((m.players ?? []) as unknown) as { player_id: string; team: string }[],
    };
  });
  const checkins = checkinsRes.data ?? [];
  const rsvps = rsvpsRes.data ?? [];

  const matchIds = matches.map((m) => m.id);
  const playerIds = new Set<string>([
    ...checkins.map((c) => c.player_id),
    ...rsvps.map((r) => r.player_id),
    ...matches.flatMap((m) => m.players.map((p) => p.player_id)),
  ]);

  const [peopleRes, historyRes] = await Promise.all([
    playerIds.size
      ? supabase.from("profiles").select("id, full_name, display_name, email, employee_no").in("id", [...playerIds])
      : Promise.resolve({ data: [], error: null }),
    matchIds.length
      ? supabase
          .from("player_ratings_history")
          .select("player_id, match_id, old_rating, new_rating, recorded_at")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (peopleRes.error) return { error: `Couldn't read players: ${peopleRes.error.message}` };

  return {
    data: buildSessionExport({
      session: sessionRes.data,
      matches,
      checkins,
      rsvps,
      ratingHistory: (historyRes.data ?? []).map((h) => ({
        player_id: h.player_id,
        match_id: h.match_id,
        old_rating: Number(h.old_rating),
        new_rating: Number(h.new_rating),
        recorded_at: h.recorded_at,
      })),
      people: peopleRes.data ?? [],
    }),
  };
}
