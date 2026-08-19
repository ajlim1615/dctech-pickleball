"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Match, MatchFormat, MatchTeam, WinningTeam } from "@/types";

export async function createMatch(params: {
  sessionId: string;
  courtId: string;
  format?: MatchFormat;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
}) {
  const supabase = await createClient();
  const format = params.format || (params.teamAPlayerIds.length === 1 ? "singles" : "doubles");

  // 1. Insert Match
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      session_id: params.sessionId,
      court_id: params.courtId,
      format,
      status: "in_progress",
      team_a_score: 0,
      team_b_score: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (matchError || !match) {
    return { error: matchError?.message || "Failed to create match." };
  }

  // 2. Link Court to Match & set occupied
  await supabase
    .from("courts")
    .update({
      status: "occupied",
      current_match_id: match.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.courtId);

  // 3. Insert Match Players
  const playersToInsert = [
    ...params.teamAPlayerIds.map((id) => ({
      match_id: match.id,
      player_id: id,
      team: "team_a" as MatchTeam,
    })),
    ...params.teamBPlayerIds.map((id) => ({
      match_id: match.id,
      player_id: id,
      team: "team_b" as MatchTeam,
    })),
  ];

  await supabase.from("match_players").insert(playersToInsert);

  revalidatePath("/");
  revalidatePath(`/sessions/${params.sessionId}`);
  revalidatePath("/matches");
  return { success: true, matchId: match.id };
}

export async function updateMatchScore(matchId: string, teamAScore: number, teamBScore: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("matches")
    .update({
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/matches");
  return { success: true };
}

export async function finalizeMatch(
  matchId: string,
  teamAScore: number,
  teamBScore: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Call the database complete_match stored procedure
  const { data, error } = await supabase.rpc("complete_match", {
    p_match_id: matchId,
    p_team_a_score: teamAScore,
    p_team_b_score: teamBScore,
    p_recorded_by: user?.id,
  });

  if (error) {
    // Fallback: manually update match & court if RPC is unavailable in client preview
    const winner: WinningTeam =
      teamAScore > teamBScore ? "team_a" : teamBScore > teamAScore ? "team_b" : "tie";

    await supabase
      .from("matches")
      .update({
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        winning_team: winner,
        status: "completed",
        ended_at: new Date().toISOString(),
        recorded_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    // Free court
    const { data: match } = await supabase.from("matches").select("court_id").eq("id", matchId).single();
    if (match) {
      await supabase
        .from("courts")
        .update({ status: "available", current_match_id: null, updated_at: new Date().toISOString() })
        .eq("id", match.court_id);
    }
  }

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  return { success: true } as { success?: boolean; error?: string };
}

export async function getMatchesList(limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(`
      *,
      court:courts (name, surface_type),
      players:match_players (
        id,
        team,
        player:profiles (
          id,
          full_name,
          display_name,
          avatar_url,
          skill_rating
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data;
}
