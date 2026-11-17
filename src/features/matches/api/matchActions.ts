"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Match, MatchFormat, WinningTeam } from "@/types";
import { callNextUp } from "@/features/queue/api/queueActions";
import { describeRule, getWinner } from "@/features/matches/utils/scoring";
import { parseSessionMetadata } from "@/lib/utils";
import {
  calculateRatingChanges,
  type RatedPlayer,
} from "@/features/rankings/utils/ratingEngine";
import { RATING_RULES } from "@/features/rankings/ratingConfig";
import { gamesPlayedBefore, planResultCorrection } from "@/features/matches/utils/resultCorrection";
import { requireAdminUser } from "@/lib/security/authGuard";
import { gameStateErrorMessage } from "@/features/matches/utils/gameStateErrors";

export async function createMatch(params: {
  sessionId: string;
  courtId: string;
  format?: MatchFormat;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
}) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  // One transaction: checks the court is open and free and that nobody picked is
  // already playing, takes the picked players out of the line, creates the game.
  // The format follows the team size (params.format is no longer needed).
  const { data, error } = await supabase.rpc("start_match", {
    p_session_id: params.sessionId,
    p_court_id: params.courtId,
    p_team_a: params.teamAPlayerIds,
    p_team_b: params.teamBPlayerIds,
    p_from_queue: false,
  });
  if (error) {
    console.error("start_match failed:", error.message);
    return { error: gameStateErrorMessage(undefined) };
  }
  const out = data as { match_id?: string; error?: string } | null;
  if (!out?.match_id) return { error: gameStateErrorMessage(out?.error) };

  revalidatePath("/");
  revalidatePath(`/sessions/${params.sessionId}`);
  revalidatePath("/matches");
  return { success: true, matchId: out.match_id };
}

export async function updateMatchScore(matchId: string, teamAScore: number, teamBScore: number) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

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
import { recordSessionEvent } from "@/features/activity/server/logEvent";

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

  // Only admins score games; finish_match enforces the same in the database.
  const auth = await requireAdminUser();
  if (auth.error || !auth.context) return { error: auth.error || "Authentication required to finalize match." };
  const user = { id: auth.context.userId };

  const supabase = await createClient();

  // Rate Limiting on Score Submission
  const rateLimit = checkRateLimit(user.id, "match_finalize", RATE_LIMIT_CONFIGS.MATCH_ACTIONS);
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  // The game and its session (scoring rule; ranked or casual).
  const { data: matchRecord } = await supabase
    .from("matches")
    .select("session_id, court_id, status, sessions:session_id (description, status)")
    .eq("id", matchId)
    .single();

  // A double tap must not record (and re-rate) the same game twice.
  if (matchRecord && matchRecord.status !== "in_progress") {
    return { error: "This game was already saved." };
  }

  // Enforce the session's scoring rule so no unfinished or impossible score is recorded.
  const sessionDescription = (matchRecord as { sessions?: { description?: string | null } | null } | null)
    ?.sessions?.description;
  const meta = parseSessionMetadata(sessionDescription);
  const rule = { targetPoints: meta.targetPoints, winByTwo: meta.winByTwo, trackScores: meta.trackScores };
  const winnerSide = getWinner(teamAScore, teamBScore, rule);
  if (!winnerSide) {
    return {
      error: `${teamAScore}-${teamBScore} is not a finished game. This session plays ${describeRule(rule)}.`,
    };
  }
  const winningTeam: WinningTeam = winnerSide === "A" ? "team_a" : "team_b";

  // Ranked games: rate from each player's rating and game count before this game
  // (finish_match bumps games_played), then save everything at once.
  let ratingChanges: ReturnType<typeof calculateRatingChanges> = [];
  if (meta.isRanked) {
    const rated = await loadRatedTeams(supabase, matchId);
    if ("error" in rated) return { error: rated.error };
    // A ranked game needs a rating change for every player, so both sides must have players.
    if (rated.teamA.length === 0 || rated.teamB.length === 0) {
      return { error: "This game is missing players on one side, so it can't be saved as ranked." };
    }
    ratingChanges = calculateRatingChanges(rated.teamA, rated.teamB, teamAScore, teamBScore, meta.targetPoints);
  }

  // One transaction: score, winner, court, totals, ratings, history, and the players
  // back in line. It only saves a game that is still in progress, so a double tap
  // can't record it twice.
  const { data: saved, error: saveError } = await supabase.rpc("finish_match", {
    p_match_id: matchId,
    p_team_a_score: teamAScore,
    p_team_b_score: teamBScore,
    p_winning_team: winningTeam,
    p_ranked: meta.isRanked,
    p_rating_changes: ratingChanges.map((c) => ({
      player_id: c.playerId,
      old_rating: c.oldRating,
      new_rating: c.newRating,
      change: c.change,
    })),
    p_rules_version: RATING_RULES.version,
    p_min_rating: RATING_RULES.min,
    p_max_rating: RATING_RULES.max,
  });
  if (saveError) {
    console.error("finish_match failed:", saveError.message);
    return { error: "The game couldn't be saved. Nothing was changed; please try again." };
  }
  const savedOutcome = saved as { error?: string } | null;
  if (savedOutcome?.error) return { error: gameStateErrorMessage(savedOutcome.error) };

  recordSessionEvent(async () => ({
    sessionId: matchRecord?.session_id ?? null,
    type: "game_result",
    actorId: user.id,
    actorRole: "admin",
    subjectIds: await matchPlayerIds(supabase, matchId),
    courtId: matchRecord?.court_id ?? null,
    matchId,
    details: {
      courtName: await courtName(supabase, matchRecord?.court_id),
      scoreA: teamAScore,
      scoreB: teamBScore,
      winner: winningTeam,
    },
  }));

  // finish_match already put everyone who just played at the back of the line; the
  // freed court now pulls the next group so the admin doesn't have to.
  const sessionId = matchRecord?.session_id;
  const courtId = matchRecord?.court_id;
  const sessionInfo = (matchRecord as { sessions?: { status?: string } | null } | null)?.sessions;
  const isSessionActive = sessionInfo?.status === "active";
  let autoFilled = false;
  let autoFillMessage: string | undefined;

  if (sessionId && isSessionActive && autoFill && courtId) {
    const next = await callNextUp(sessionId, courtId, 4);
    autoFilled = Boolean(next?.success);
    autoFillMessage = next?.error;
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
      court: (m.court_id && courtMap.get(m.court_id)) || { name: "Court", surface_type: "Standard Court" },
    }));
  }

  return data || [];
}

export const getMatches = getMatchesList;

type RatedTeams = { teamA: RatedPlayer[]; teamB: RatedPlayer[] };

const RATED_LOAD_ERROR = "Couldn't read the players' ratings. Nothing was changed; please try again.";

/** Never defaults a missing rating: a failed or incomplete read is an error, so a real rating can't be overwritten. */
async function loadRatedTeams(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId: string
): Promise<RatedTeams | { error: string }> {
  const { data: rows, error: rowsError } = await supabase
    .from("match_players")
    .select("player_id, team")
    .eq("match_id", matchId);
  if (rowsError) {
    console.error("loadRatedTeams (match_players) failed:", rowsError.message);
    return { error: RATED_LOAD_ERROR };
  }
  const teams: RatedTeams = { teamA: [], teamB: [] };
  if (!rows || rows.length === 0) return teams;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, skill_rating, games_played")
    .in("id", rows.map((r) => r.player_id));
  if (profilesError || !profiles) {
    console.error("loadRatedTeams (profiles) failed:", profilesError?.message);
    return { error: RATED_LOAD_ERROR };
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));

  for (const row of rows) {
    const profile = byId.get(row.player_id);
    if (!profile) {
      console.error("loadRatedTeams: no profile for player", row.player_id);
      return { error: RATED_LOAD_ERROR };
    }
    const player: RatedPlayer = {
      id: row.player_id,
      rating: Number(profile.skill_rating),
      gamesPlayed: Number(profile.games_played ?? 0),
    };
    (row.team === "team_a" ? teams.teamA : teams.teamB).push(player);
  }
  return teams;
}

/** Admin fix for a saved game: new score, winner, ratings and wins follow. */
export async function correctMatchResult(matchId: string, scoreA: number, scoreB: number) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const validation = FinalizeMatchSchema.safeParse({ matchId, teamAScore: scoreA, teamBScore: scoreB });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid score." };
  }

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, session_id, court_id, status, team_a_score, team_b_score, sessions:session_id (description)")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Game not found." };
  if (match.status !== "completed") return { error: "Only finished games can be corrected." };

  const description = (match as { sessions?: { description?: string | null } | null }).sessions?.description;
  const meta = parseSessionMetadata(description);
  const rule = { targetPoints: meta.targetPoints, winByTwo: meta.winByTwo, trackScores: meta.trackScores };
  const oldScore = { a: Number(match.team_a_score ?? 0), b: Number(match.team_b_score ?? 0) };

  const [rated, { data: historyRows }] = await Promise.all([
    loadRatedTeams(supabase, matchId),
    supabase
      .from("player_ratings_history")
      .select("player_id, old_rating, rating_change, recorded_at")
      .eq("match_id", matchId),
  ]);

  // Rate each player as they were when the game was played: count only the ranked
  // games they had before it, so provisional players keep their faster rate.
  if ("error" in rated) return { error: rated.error };
  const { teamA, teamB } = rated;
  const gamesAfter = new Map<string, number>();
  await Promise.all(
    (historyRows || []).map(async (h) => {
      const { count } = await supabase
        .from("player_ratings_history")
        .select("id", { count: "exact", head: true })
        .eq("player_id", h.player_id)
        .not("match_id", "is", null) // admin edits aren't games
        .gt("recorded_at", h.recorded_at);
      gamesAfter.set(h.player_id, count || 0);
    })
  );
  const asPlayedThen = (team: RatedPlayer[]) =>
    team.map((p) => (gamesAfter.has(p.id) ? { ...p, gamesPlayed: gamesPlayedBefore(p.gamesPlayed, gamesAfter.get(p.id)!) } : p));

  const plan = planResultCorrection({
    rule,
    isRanked: meta.isRanked,
    oldScore,
    newScore: { a: scoreA, b: scoreB },
    teamA: asPlayedThen(teamA),
    teamB: asPlayedThen(teamB),
    history: (historyRows || []).map((h) => ({
      playerId: h.player_id,
      oldRating: Number(h.old_rating),
      change: Number(h.rating_change),
    })),
  });
  if (plan.error || !plan.winningTeam) return { error: plan.error || "Invalid result." };
  if (plan.unchanged) return { success: true as const };

  // One locked transaction: only applies if the score is still what we read, and
  // ratings/wins move by relative amounts so a game finishing meanwhile isn't lost.
  const { data: result, error } = await supabase.rpc("apply_result_correction", {
    p_match_id: matchId,
    p_expected_a: oldScore.a,
    p_expected_b: oldScore.b,
    p_new_a: scoreA,
    p_new_b: scoreB,
    p_winning_team: plan.winningTeam,
    p_rating_updates: plan.ratingUpdates.map((u) => ({ player_id: u.playerId, delta: u.delta, new_change: u.newChange })),
    p_wins_moves: plan.winsMoves.map((m) => ({ player_id: m.playerId, by: m.by })),
    p_rules_version: RATING_RULES.version,
    p_min_rating: RATING_RULES.min,
    p_max_rating: RATING_RULES.max,
  });
  if (error) {
    return {
      error: error.message.includes("apply_result_correction")
        ? "Result fixes aren't set up yet: apply the apply_result_correction database migration."
        : error.message,
    };
  }
  const outcome = result as { error?: string } | null;
  if (outcome?.error) return { error: outcome.error };

  recordSessionEvent(async () => ({
    sessionId: match.session_id,
    type: "result_corrected",
    actorId: auth.context!.userId,
    actorRole: "admin",
    subjectIds: [...teamA, ...teamB].map((p) => p.id),
    matchId,
    courtId: match.court_id,
    details: { courtName: await courtName(supabase, match.court_id), from: oldScore, to: { a: scoreA, b: scoreB } },
  }));

  if (match.session_id) revalidatePath(`/sessions/${match.session_id}`);
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  return { success: true as const };
}

async function matchPlayerIds(supabase: Awaited<ReturnType<typeof createClient>>, matchId: string): Promise<string[]> {
  const { data } = await supabase.from("match_players").select("player_id").eq("match_id", matchId);
  return (data || []).map((row) => row.player_id);
}

async function courtName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courtId: string | null | undefined
): Promise<string | null> {
  if (!courtId) return null;
  const { data } = await supabase.from("courts").select("name").eq("id", courtId).maybeSingle();
  return data?.name ?? null;
}
