"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export interface RankedPlayer extends Profile {
  rank: number;
  win_rate: number;
}

export async function getLeaderboard(): Promise<RankedPlayer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .neq("email", "admin@dctechmicro.com");

  if (error || !data) return [];

  // Calculate stats and format
  const formatted = data.map((profile) => {
    const gamesPlayed = Number(profile.games_played || 0);
    const gamesWon = Number(profile.games_won || 0);
    const skillRating = Number(profile.skill_rating || 3.0);
    const winRate =
      gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    return {
      ...profile,
      skill_rating: skillRating,
      games_played: gamesPlayed,
      games_won: gamesWon,
      win_rate: winRate,
    };
  });

  // Official Ranking sorting hierarchy:
  // 1. Games Won descending (Most wins at the top)
  // 2. Games Played descending (Total participation)
  // 3. Win Rate (%) descending
  // 4. Skill Rating (DUPR) descending
  // 5. Alphabetical name ascending
  formatted.sort((a, b) => {
    if (b.games_won !== a.games_won) {
      return b.games_won - a.games_won;
    }
    if (b.games_played !== a.games_played) {
      return b.games_played - a.games_played;
    }
    if (b.win_rate !== a.win_rate) {
      return b.win_rate - a.win_rate;
    }
    if (b.skill_rating !== a.skill_rating) {
      return b.skill_rating - a.skill_rating;
    }
    const nameA = (a.full_name || a.display_name || "").toLowerCase();
    const nameB = (b.full_name || b.display_name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return formatted.map((player, idx) => ({
    ...player,
    rank: idx + 1,
  }));
}
