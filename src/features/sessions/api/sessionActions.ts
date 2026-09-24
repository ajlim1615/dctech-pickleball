"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Session, SessionCheckin, SessionStatus } from "@/types";

export async function getSessions(): Promise<Session[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("start_time", { ascending: true });

  if (error || !data) return [];
  return data as Session[];
}

export async function getSessionById(id: string) {
  const supabase = await createClient();

  const [sessionRes, checkinsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("session_checkins")
      .select(`
        id,
        session_id,
        player_id,
        status,
        checkin_time,
        player:profiles (
          id,
          full_name,
          display_name,
          avatar_url,
          skill_rating,
          email
        )
      `)
      .eq("session_id", id)
      .eq("status", "checked_in"),
  ]);

  if (sessionRes.error || !sessionRes.data) return null;

  return {
    ...sessionRes.data,
    checkins: checkinsRes.data || [],
  };
}

import {
  computeSessionLeaderboard,
  type SessionRankedPlayer,
} from "../utils/sessionLeaderboard";
export type { SessionRankedPlayer };

export async function getSessionMatches(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(`
      *,
      court:courts!court_id (id, name, surface_type),
      players:match_players (
        id,
        team,
        player:profiles (
          id,
          full_name,
          display_name,
          avatar_url,
          skill_rating,
          email
        )
      )
    `)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    // If embedding with explicit FK has issue, fetch matches & courts separately and combine
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
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false }),
      supabase.from("courts").select("id, name, surface_type"),
    ]);

    if (matchesRes.error || !matchesRes.data) return [];
    const courtMap = new Map((courtsRes.data || []).map((c) => [c.id, c]));
    return matchesRes.data.map((m) => ({
      ...m,
      court: courtMap.get(m.court_id) || { id: m.court_id, name: "Court", surface_type: "Standard Court" },
    }));
  }
  return data || [];
}

export async function getSessionLeaderboard(sessionId: string): Promise<SessionRankedPlayer[]> {
  const supabase = await createClient();

  const [sessionRes, matchesRes] = await Promise.all([
    supabase
      .from("session_checkins")
      .select(`
        id,
        player_id,
        player:profiles (
          id,
          full_name,
          display_name,
          avatar_url,
          skill_rating,
          email
        )
      `)
      .eq("session_id", sessionId)
      .eq("status", "checked_in"),
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
            skill_rating,
            email
          )
        )
      `)
      .eq("session_id", sessionId)
      .eq("status", "completed"),
  ]);

  const checkins = sessionRes.data || [];
  const matches = matchesRes.data || [];

  return computeSessionLeaderboard(matches, checkins);
}

import { requireAdminUser } from "@/lib/security/authGuard";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rateLimit";
import { sanitizeString } from "@/lib/security/validation";

export async function createSession(formData: FormData) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const rawTitle = formData.get("title") as string;
  const rawDescription = formData.get("description") as string;
  const rawLocation = (formData.get("location") as string) || "DCTECH Sports Arena";
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const maxPlayersStr = formData.get("maxPlayers") as string;
  const courtCountStr = formData.get("courtCount") as string;
  const courtCount = courtCountStr ? parseInt(courtCountStr, 10) : 4;
  const isRanked = formData.get("isRanked") !== "false";
  const targetPointsStr = (formData.get("targetPoints") as string) || "11";
  const targetPoints = parseInt(targetPointsStr, 10) === 6 ? 6 : 11;

  if (!rawTitle || !startTime || !endTime) {
    return { error: "Session title, start time, and end time are required." };
  }

  const title = sanitizeString(rawTitle);
  const location = sanitizeString(rawLocation);
  const matchingStyle = sanitizeString((formData.get("matchingStyle") as string) || "balanced");
  const userDesc = sanitizeString(rawDescription || "");

  const tags = `[matching_mode:${matchingStyle}] [ranked:${isRanked}] [target_points:${targetPoints}]`;
  const finalDescription = userDesc ? `${userDesc} ${tags}` : tags;

  const supabase = await createClient();
  const userId = auth.context?.userId || "";
  const isoStartTime = new Date(startTime).toISOString();

  // Idempotency / Duplicate Creation Guard (within last 10 seconds)
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from("sessions")
    .select("id")
    .eq("title", title)
    .eq("start_time", isoStartTime)
    .gte("created_at", tenSecondsAgo)
    .maybeSingle();

  if (recentDuplicate) {
    // Return existing session ID idempotently to prevent duplicate sessions
    return { success: true, sessionId: recentDuplicate.id };
  }

  const { error } = await supabase.from("sessions").insert({
    title,
    description: finalDescription,
    location,
    start_time: isoStartTime,

    end_time: new Date(endTime).toISOString(),
    max_players: maxPlayersStr ? Math.min(200, Math.max(2, parseInt(maxPlayersStr, 10))) : null,
    created_by: userId,
    status: "scheduled",
  });

  if (error) {
    return { error: error.message };
  }

  // Provision rented courts for this session
  if (courtCount > 0) {
    const { data: existingCourts } = await supabase.from("courts").select("id, name, sort_order");
    const currentCount = existingCourts?.length || 0;

    if (currentCount === 0) {
      const courtsToInsert = Array.from({ length: courtCount }, (_, i) => ({
        name: `Court ${i + 1}`,
        surface_type: "Standard Court",
        status: "available" as const,
        sort_order: i + 1,
      }));
      const { error: courtInsertError } = await supabase.from("courts").insert(courtsToInsert);
      if (courtInsertError) {
        console.error("Failed to provision courts:", courtInsertError.message);
      }
    } else if (courtCount > currentCount) {
      const courtsToInsert = Array.from({ length: courtCount - currentCount }, (_, i) => ({
        name: `Court ${currentCount + i + 1}`,
        surface_type: "Standard Court",
        status: "available" as const,
        sort_order: currentCount + i + 1,
      }));
      const { error: courtInsertError } = await supabase.from("courts").insert(courtsToInsert);
      if (courtInsertError) {
        console.error("Failed to add courts:", courtInsertError.message);
      }
    }
  }

  revalidatePath("/sessions");
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  // If activating a session, deactivate any other active sessions to maintain single active session clarity
  if (status === "active") {
    await supabase
      .from("sessions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("status", "active")
      .neq("id", sessionId);

    // Free all courts for the incoming session
    await supabase
      .from("courts")
      .update({ status: "available", current_match_id: null, updated_at: new Date().toISOString() })
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }

  // Update target session
  const { error } = await supabase
    .from("sessions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // If completing or cancelling a session, clear its active queue and free courts
  if (status === "completed" || status === "cancelled") {
    // Clear lingering waiting/called queue entries
    await supabase
      .from("queue_entries")
      .update({ status: "left" })
      .eq("session_id", sessionId)
      .in("status", ["waiting", "called"]);

    // Free courts
    await supabase
      .from("courts")
      .update({ status: "available", current_match_id: null, updated_at: new Date().toISOString() })
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }

  // Ensure baseline courts exist
  if (status === "active") {
    const { data: existingCourts } = await supabase.from("courts").select("id");
    if (!existingCourts || existingCourts.length === 0) {
      const courtsToInsert = Array.from({ length: 4 }, (_, i) => ({
        name: `Court ${i + 1}`,
        surface_type: "Standard Court",
        status: "available" as const,
        sort_order: i + 1,
      }));
      await supabase.from("courts").insert(courtsToInsert);
    }
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/admin");
  revalidatePath("/queue");
  revalidatePath("/matches");
  revalidatePath("/");
  return { success: true };
}

export async function checkInToSession(sessionId: string, playerId?: string) {
  const supabase = await createClient();
  let targetPlayerId = playerId;

  if (!targetPlayerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required to check in." };
    targetPlayerId = user.id;
  }

  // Guard: Root system admin cannot check in to play
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", targetPlayerId).single();
  if (profile?.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account (admin@dctechmicro.com) is a non-playing administrator and cannot check in to play." };
  }

  const { error } = await supabase.from("session_checkins").upsert(
    {
      session_id: sessionId,
      player_id: targetPlayerId,
      status: "checked_in",
      checkin_time: new Date().toISOString(),
    },
    { onConflict: "session_id,player_id" }
  );

  if (error) return { error: error.message };

  // Also auto-enter the waiting queue if not already queued
  const { data: existingQueue } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId)
    .in("status", ["waiting", "called"])
    .maybeSingle();

  if (!existingQueue) {
    await supabase.from("queue_entries").insert({
      session_id: sessionId,
      player_id: targetPlayerId,
      status: "waiting",
    });
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/queue");
  revalidatePath("/");
  return { success: true };
}

export async function checkOutOfSession(sessionId: string, playerId?: string) {
  const supabase = await createClient();
  let targetPlayerId = playerId;

  if (!targetPlayerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required." };
    targetPlayerId = user.id;
  }

  const { error } = await supabase
    .from("session_checkins")
    .update({ status: "checked_out" })
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true };
}
