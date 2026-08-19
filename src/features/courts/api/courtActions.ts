"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Court, CourtStatus, ActiveCourtView } from "@/types";

export async function getCourts(): Promise<ActiveCourtView[]> {
  const supabase = await createClient();
  const { data: courts, error: courtsError } = await supabase
    .from("courts")
    .select(`
      id,
      name,
      surface_type,
      status,
      current_match_id,
      sort_order,
      assigned_staff_id,
      assigned_staff:profiles!assigned_staff_id (
        id,
        full_name,
        display_name,
        avatar_url
      )
    `)
    .order("sort_order", { ascending: true });

  if (courtsError) {
    console.error("getCourts error from Supabase:", courtsError.message);
    return [];
  }

  if (!courts || courts.length === 0) return [];

  // Fetch in-progress matches for these courts to avoid ambiguous PostgREST join
  const { data: activeMatches, error: matchesError } = await supabase
    .from("matches")
    .select(`
      id,
      session_id,
      court_id,
      format,
      match_type,
      status,
      team_a_score,
      team_b_score,
      winning_team,
      started_at,
      ended_at,
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
    .eq("status", "in_progress");

  if (matchesError) {
    console.error("activeMatches error from Supabase:", matchesError.message);
  }

  const matchByCourtId = new Map(
    activeMatches?.map((m) => [m.court_id, m]) || []
  );

  return courts.map((c) => ({
    ...c,
    current_match: matchByCourtId.get(c.id) || null,
  })) as unknown as ActiveCourtView[];
}

export async function updateCourtStatus(courtId: string, status: CourtStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", courtId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin/courts");
  return { success: true };
}
