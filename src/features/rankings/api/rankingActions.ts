"use server";

import { createClient } from "@/lib/supabase/server";
import { buildLeaderboard, type RankedPlayer } from "../utils/leaderboard";

export type { RankedPlayer };

export async function getLeaderboard(options?: { since?: string }): Promise<RankedPlayer[]> {
  const supabase = await createClient();

  // Totals come from the database: only completed matches in active/completed,
  // non-[ranked:false] sessions count (see leaderboard_stats).
  const [profilesRes, totalsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .neq("email", "admin@dctechmicro.com"),
    supabase.rpc("leaderboard_stats", { p_since: options?.since ?? null }),
  ]);

  if (profilesRes.error || !profilesRes.data) {
    console.error("getLeaderboard: failed to load profiles", profilesRes.error);
    return [];
  }
  if (totalsRes.error || !totalsRes.data) {
    // Without totals every player would look brand new; fail loudly instead.
    console.error("getLeaderboard: leaderboard_stats rpc failed", totalsRes.error);
    return [];
  }

  return buildLeaderboard(profilesRes.data, totalsRes.data);
}
