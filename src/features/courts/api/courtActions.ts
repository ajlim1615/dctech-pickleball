"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/security/authGuard";
import { gameStateErrorMessage } from "@/features/matches/utils/gameStateErrors";
import type { Court, CourtStatus, ActiveCourtView } from "@/types";

const readCourts = cache(async (): Promise<ActiveCourtView[]> => {
  const supabase = await createClient();

  const [courtsRes, matchesRes] = await Promise.all([
    supabase
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
          skill_rating
        )
      `)
      .order("sort_order", { ascending: true }),
    supabase
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
            skill_rating
          )
        )
      `)
      .eq("status", "in_progress"),
  ]);

  if (courtsRes.error) {
    console.error("getCourts error from Supabase:", courtsRes.error.message);
    return [];
  }

  const courts = courtsRes.data;
  if (!courts || courts.length === 0) return [];

  if (matchesRes.error) {
    console.error("activeMatches error from Supabase:", matchesRes.error.message);
  }

  const matchByCourtId = new Map(
    matchesRes.data?.map((m) => [m.court_id, m]) || []
  );

  return courts.map((c) => ({
    ...c,
    current_match: matchByCourtId.get(c.id) || null,
  })) as unknown as ActiveCourtView[];
});

export async function getCourts(): Promise<ActiveCourtView[]> {
  return readCourts();
}

/** Statuses an admin sets by hand. "occupied" is owned by the game procedures. */
const ADMIN_COURT_STATUSES: CourtStatus[] = ["available", "maintenance", "reserved"];

export async function updateCourtStatus(courtId: string, status: CourtStatus) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  if (!ADMIN_COURT_STATUSES.includes(status)) {
    return { error: "Courts can only be opened, closed or reserved here." };
  }

  const supabase = await createClient();

  // A court with a game in progress keeps it: save or end that game first.
  const { data: live } = await supabase
    .from("matches")
    .select("id")
    .eq("court_id", courtId)
    .eq("status", "in_progress")
    .limit(1);
  if (live && live.length > 0) {
    return { error: gameStateErrorMessage("court_busy") };
  }

  const { error } = await supabase
    .from("courts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", courtId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin/courts");
  return { success: true };
}
