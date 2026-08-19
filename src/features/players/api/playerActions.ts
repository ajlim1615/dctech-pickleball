"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Match, PlayerRatingHistory, Database } from "@/types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(userId: string, formData: FormData) {
  const supabase = await createClient();
  const displayName = formData.get("displayName") as string;
  const fullName = formData.get("fullName") as string;
  const avatarUrl = formData.get("avatarUrl") as string;

  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (displayName) updates.display_name = displayName;
  if (fullName) updates.full_name = fullName;
  if (avatarUrl) updates.avatar_url = avatarUrl;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

export async function getPlayerMatchHistory(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("match_players")
    .select(`
      id,
      team,
      match:matches (
        id,
        session_id,
        court:courts (name),
        format,
        status,
        team_a_score,
        team_b_score,
        winning_team,
        started_at,
        ended_at
      )
    `)
    .eq("player_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return [];
  return data;
}

export async function getPlayerRatingHistory(userId: string): Promise<PlayerRatingHistory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_ratings_history")
    .select("*")
    .eq("player_id", userId)
    .order("recorded_at", { ascending: true });

  if (error || !data) return [];
  return data as PlayerRatingHistory[];
}
