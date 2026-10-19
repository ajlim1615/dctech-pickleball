"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Match, MatchFormat, MatchTeam, WinningTeam } from "@/types";
import { callNextUp } from "@/features/queue/api/queueActions";
import { selectPlayersToRequeue } from "@/features/queue/utils/requeue";
import { describeRule, getWinner } from "@/features/matches/utils/scoring";
import { parseSessionMetadata } from "@/lib/utils";

export async function createMatch(params: {
  sessionId: string;
  courtId: string;
  format?: MatchFormat;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
}) {
  const supabase = await createClient();
  const format = params.format || (params.teamAPlayerIds.length === 1 ? "singles" : "doubles");

  // 0. Cancel previous orphaned in-progress matches on this court if any
  await supabase
    .from("matches")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("court_id", params.courtId)
    .eq("status", "in_progress");

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

import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rateLimit";
import { FinalizeMatchSchema } from "@/lib/security/validation";

export async function finalizeMatch(
  matchId: string,
  teamAScore: number,
  teamBScore: number,
  options: { autoFill?: boolean } = {}
) {
  const { autoFill = true } = options;
  const validation = FinalizeMatchSchema.safeParse({ matchId, teamAScore, teamBScore });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid match score parameters." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to finalize match." };
  }

  // Rate Limiting on Score Submission
  const rateLimit = checkRateLimit(user.id, "match_finalize", RATE_LIMIT_CONFIGS.MATCH_ACTIONS);
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  // Check if this match belongs to a Casual / Unranked session ([ranked:false])
  const { data: matchRecord } = await supabase
    .from("matches")
    .select("session_id, court_id, sessions:session_id (description, status)")
    .eq("id", matchId)
    .single();

  const isUnranked = Boolean(
    (matchRecord as any)?.sessions?.description?.includes("[ranked:false]")
  );

  // Enforce the session's scoring rule so no unfinished or impossible score is recorded.
  const sessionDescription = (matchRecord as { sessions?: { description?: string | null } | null } | null)
    ?.sessions?.description;
  const meta = parseSessionMetadata(sessionDescription);
  const rule = { targetPoints: meta.targetPoints, winByTwo: meta.winByTwo, trackScores: meta.trackScores };
  if (!getWinner(teamAScore, teamBScore, rule)) {
    return {
      error: `${teamAScore}-${teamBScore} is not a finished game. This session plays ${describeRule(rule)}.`,
    };
  }

  if (isUnranked) {
    // Unranked casual match: record official score & free court, but bypass DUPR updates
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
        recorded_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (matchRecord?.court_id) {
      await supabase
        .from("courts")
        .update({ status: "available", current_match_id: null, updated_at: new Date().toISOString() })
        .eq("id", matchRecord.court_id);
    }
  } else {
    // Call the database complete_match stored procedure for ranked matches
    const { error } = await supabase.rpc("complete_match", {
      p_match_id: matchId,
      p_team_a_score: teamAScore,
      p_team_b_score: teamBScore,
      p_recorded_by: user.id,
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
          recorded_by: user.id,
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
  }

  // Everyone who just played rejoins the back of the line, then the freed court
  // pulls the next group so the admin doesn't have to.
  const sessionId = matchRecord?.session_id;
  const courtId = matchRecord?.court_id;
  const sessionInfo = (matchRecord as { sessions?: { status?: string } | null } | null)?.sessions;
  const isSessionActive = sessionInfo?.status === "active";
  let autoFilled = false;
  let autoFillMessage: string | undefined;

  if (sessionId && isSessionActive) {
    await requeueMatchPlayers(supabase, matchId, sessionId);

    if (autoFill && courtId) {
      const next = await callNextUp(sessionId, courtId, 4);
      autoFilled = Boolean(next?.success);
      autoFillMessage = next?.error;
    }
  }

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  if (sessionId) revalidatePath(`/sessions/${sessionId}`);
  return { success: true, autoFilled, autoFillMessage } as {
    success?: boolean;
    error?: string;
    autoFilled?: boolean;
    autoFillMessage?: string;
  };
}

async function requeueMatchPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId: string,
  sessionId: string
) {
  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("player_id")
    .eq("match_id", matchId);
  const playerIds = (matchPlayers || []).map((p) => p.player_id);
  if (playerIds.length === 0) return;

  // Release entries still marked "playing" (the casual path never cleared them).
  await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("session_id", sessionId)
    .eq("status", "playing")
    .in("player_id", playerIds);

  const [{ data: checkins }, { data: entries }] = await Promise.all([
    supabase
      .from("session_checkins")
      .select("player_id")
      .eq("session_id", sessionId)
      .eq("status", "checked_in")
      .in("player_id", playerIds),
    supabase
      .from("queue_entries")
      .select("player_id, group_id, status")
      .eq("session_id", sessionId)
      .in("player_id", playerIds)
      .order("joined_at", { ascending: false }),
  ]);

  // Entries come newest first, so the first group_id seen per player is the latest.
  const previousGroupIds: Record<string, string | null> = {};
  for (const e of entries || []) {
    if (!(e.player_id in previousGroupIds)) previousGroupIds[e.player_id] = e.group_id;
  }

  const toRequeue = selectPlayersToRequeue({
    matchPlayerIds: playerIds,
    checkedInIds: (checkins || []).map((c) => c.player_id),
    activeQueueIds: (entries || [])
      .filter((e) => e.status === "waiting" || e.status === "called" || e.status === "playing")
      .map((e) => e.player_id),
    previousGroupIds,
  });

  if (toRequeue.length > 0) {
    await supabase.from("queue_entries").insert(
      toRequeue.map((e) => ({
        session_id: sessionId,
        player_id: e.player_id,
        group_id: e.group_id,
        status: "waiting" as const,
      }))
    );
  }
}

export async function getMatchesList(limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(`
      *,
      court:courts!court_id (name, surface_type),
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

  if (error) {
    const [matchesRes, courtsRes] = await Promise.all([
      supabase
        .from("matches")
        .select(`
          *,
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
        .limit(limit),
      supabase.from("courts").select("id, name, surface_type"),
    ]);

    if (matchesRes.error || !matchesRes.data) return [];
    const courtMap = new Map((courtsRes.data || []).map((c) => [c.id, c]));
    return matchesRes.data.map((m) => ({
      ...m,
      court: courtMap.get(m.court_id) || { name: "Court", surface_type: "Standard Court" },
    }));
  }

  return data || [];
}

export const getMatches = getMatchesList;
