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
    .gt("games_played", 0)
    .order("skill_rating", { ascending: false })
    .order("games_won", { ascending: false });

  if (error || !data) return [];

  return data.map((profile, idx) => {
    const winRate =
      profile.games_played > 0
        ? Math.round((profile.games_won / profile.games_played) * 100)
        : 0;

    return {
      ...profile,
      rank: idx + 1,
      win_rate: winRate,
    };
  });
}
