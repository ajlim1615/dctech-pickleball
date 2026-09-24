"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export interface RankedPlayer extends Profile {
  rank: number;
  win_rate: number;
}

export async function getLeaderboard(): Promise<RankedPlayer[]> {
  const supabase = await createClient();

  // Fetch active profiles (excluding non-playing root admin), completed sessions & matches in parallel
  // Matches from active / in-progress sessions must NOT be pre-recorded in global rankings!
  // Casual / Unranked sessions ([ranked:false]) are excluded from global leaderboard standings.
  const [profilesRes, completedSessionsRes, completedMatchesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .neq("email", "admin@dctechmicro.com"),
    supabase.from("sessions").select("id, description").eq("status", "completed"),
    supabase
      .from("matches")
      .select(`
        id,
        session_id,
        team_a_score,
        team_b_score,
        winning_team,
        status,
        players:match_players (
          player_id,
          team
        )
      `)
      .eq("status", "completed"),
  ]);

  const profiles = profilesRes.data;
  if (profilesRes.error || !profiles) return [];

  // Only include sessions that are NOT tagged as [ranked:false]
  const completedRankedSessionIds = new Set(
    (completedSessionsRes.data || [])
      .filter((s) => !s.description?.includes("[ranked:false]"))
      .map((s) => s.id)
  );

  // Filter matches that belong strictly to finished, ranked sessions
  const finishedSessionMatches = (completedMatchesRes.data || []).filter(
    (m) => m.session_id && completedRankedSessionIds.has(m.session_id)
  );

  // 3. Compute stats for each player from completed sessions
  const statsMap = new Map<
    string,
    {
      games_played: number;
      games_won: number;
      games_lost: number;
      points_scored: number;
      points_conceded: number;
    }
  >();

  for (const m of finishedSessionMatches) {
    const teamAScore = Number(m.team_a_score || 0);
    const teamBScore = Number(m.team_b_score || 0);
    const winningTeam =
      m.winning_team ||
      (teamAScore > teamBScore ? "team_a" : teamBScore > teamAScore ? "team_b" : "tie");

    const playersList = ((m as any).players || []) as Array<{ player_id: string; team: string }>;
    for (const mp of playersList) {
      const pid = mp.player_id;
      if (!pid) continue;

      const current = statsMap.get(pid) || {
        games_played: 0,
        games_won: 0,
        games_lost: 0,
        points_scored: 0,
        points_conceded: 0,
      };

      current.games_played += 1;
      if (mp.team === "team_a") {
        current.points_scored += teamAScore;
        current.points_conceded += teamBScore;
        if (winningTeam === "team_a") current.games_won += 1;
        else if (winningTeam === "team_b") current.games_lost += 1;
      } else if (mp.team === "team_b") {
        current.points_scored += teamBScore;
        current.points_conceded += teamAScore;
        if (winningTeam === "team_b") current.games_won += 1;
        else if (winningTeam === "team_a") current.games_lost += 1;
      }

      statsMap.set(pid, current);
    }
  }

  // 4. Format profiles with computed finished-session stats
  const formatted = profiles.map((profile) => {
    const stats = statsMap.get(profile.id) || {
      games_played: 0,
      games_won: 0,
      games_lost: 0,
      points_scored: 0,
      points_conceded: 0,
    };

    const gamesPlayed = stats.games_played;
    const gamesWon = stats.games_won;
    const skillRating = Number(profile.skill_rating || 3.0);
    const winRate =
      gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const pointDiff = stats.points_scored - stats.points_conceded;

    return {
      ...profile,
      skill_rating: skillRating,
      games_played: gamesPlayed,
      games_won: gamesWon,
      win_rate: winRate,
      point_diff: pointDiff,
    };
  });

  // 5. Official Ranking sorting hierarchy:
  // 1. Games Won descending (Most wins at the top)
  // 2. Games Played descending (Total participation)
  // 3. Win Rate (%) descending
  // 4. Point Differential descending
  // 5. Skill Rating (DUPR) descending
  // 6. Alphabetical name ascending
  formatted.sort((a, b) => {
    if (b.games_won !== a.games_won) return b.games_won - a.games_won;
    if (b.games_played !== a.games_played) return b.games_played - a.games_played;
    if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
    if ((b as any).point_diff !== (a as any).point_diff) {
      return (b as any).point_diff - (a as any).point_diff;
    }
    if (b.skill_rating !== a.skill_rating) return b.skill_rating - a.skill_rating;
    const nameA = (a.full_name || a.display_name || "").toLowerCase();
    const nameB = (b.full_name || b.display_name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return formatted.map((player, idx) => ({
    ...player,
    rank: idx + 1,
  }));
}
