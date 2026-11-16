"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePHTToISO } from "@/lib/timezone";
import { recordSessionEvent } from "@/features/activity/server/logEvent";
import { planStartingLine } from "@/features/queue/startingLine";
import { queueClosedReason } from "@/features/queue/utils/queueOpen";
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
      court: (m.court_id && courtMap.get(m.court_id)) || { id: m.court_id, name: "Court", surface_type: "Standard Court" },
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
import { parseCourtCount, parseSessionMetadata, parseSkillSpread } from "@/lib/utils";
import { DEFAULT_COURT_COUNT } from "@/lib/constants";
import { setRentedCourtCount } from "@/features/admin/api/adminActions";

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
  // Courts belong to the session; the arena switches to this number when it starts.
  const courtCount = parseCourtCount(formData.get("courtCount") as string | null) ?? DEFAULT_COURT_COUNT;
  const isRanked = formData.get("isRanked") !== "false";
  const targetPointsStr = (formData.get("targetPoints") as string) || "11";
  const targetPoints = parseInt(targetPointsStr, 10) === 6 ? 6 : 11;
  // Unset means the old default: win by 2 at 11, first to 6 at 6.
  const winByRaw = formData.get("winByTwo") as string | null;
  const winByTwo = winByRaw ? winByRaw !== "false" : targetPoints !== 6;
  const trackScores = (formData.get("trackScores") as string | null) !== "false";

  if (!rawTitle || !startTime || !endTime) {
    return { error: "Session title, start time, and end time are required." };
  }

  const title = sanitizeString(rawTitle);
  const location = sanitizeString(rawLocation);
  const matchingStyle = sanitizeString((formData.get("matchingStyle") as string) || "balanced");
  const userDesc = sanitizeString(rawDescription || "");

  const usesSkillSpread = matchingStyle === "skill_separated" || matchingStyle === "skill_courts";
  const skillSpreadTag = usesSkillSpread
    ? ` [skill_spread:${parseSkillSpread(formData.get("skillSpread") as string | null)}]`
    : "";
  const tags = `[matching_mode:${matchingStyle}] [ranked:${isRanked}] [target_points:${targetPoints}] [win_by:${winByTwo ? 2 : 1}] [scoring:${trackScores ? "points" : "result"}]${skillSpreadTag} [courts:${courtCount}] [partners:${formData.get("allowPartners") === "true"}]`;
  const finalDescription = userDesc ? `${userDesc} ${tags}` : tags;

  const supabase = await createClient();
  const userId = auth.context?.userId || "";
  const isoStartTime = parsePHTToISO(startTime);
  const isoEndTime = parsePHTToISO(endTime);

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
    end_time: isoEndTime,
    max_players: maxPlayersStr ? Math.min(200, Math.max(2, parseInt(maxPlayersStr, 10))) : null,
    created_by: userId,
    status: "scheduled",
  });

  if (error) {
    return { error: error.message };
  }

  // No court changes here: creating a future session must not touch the courts
  // another session is using. The arena switches to this count when it starts.

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

  // Only a scheduled -> active start builds the shuffled starting line.
  const { data: before } = await supabase
    .from("sessions")
    .select("status, description")
    .eq("id", sessionId)
    .maybeSingle();
  const isFirstStart = status === "active" && before?.status === "scheduled";

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

  let startingLineError: string | null = null;
  if (isFirstStart) {
    startingLineError = await buildStartingLine(supabase, sessionId);
  }

  if (status === "active" || status === "completed") {
    recordSessionEvent({
      sessionId,
      type: status === "active" ? "session_started" : "session_ended",
      actorId: auth.context!.userId,
      actorRole: "admin",
    });
  }

  // If completing or cancelling a session, clear its active queue and free courts
  if (status === "completed" || status === "cancelled") {
    // Clear lingering queue entries, including players still on court
    await supabase
      .from("queue_entries")
      .update({ status: "left" })
      .eq("session_id", sessionId)
      .neq("status", "left"); // waiting, called, playing or on_break

    // Unfinished games are not scored
    await supabase
      .from("matches")
      .update({ status: "abandoned", ended_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("status", "in_progress");

    // Free courts
    await supabase
      .from("courts")
      .update({ status: "available", current_match_id: null, updated_at: new Date().toISOString() })
      .neq("id", "00000000-0000-0000-0000-000000000000");
  }

  // The arena runs on this session's own court count (older sessions: the default).
  // Courts were all freed above, so none is mid-game.
  if (status === "active") {
    const wanted = parseSessionMetadata(before?.description).courtCount ?? DEFAULT_COURT_COUNT;
    const courtRes = await setRentedCourtCount(wanted, "Standard Court");
    if (courtRes?.error && !startingLineError) {
      startingLineError = `the courts could not be set to ${wanted}: ${courtRes.error}`;
    }
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/admin");
  revalidatePath("/queue");
  revalidatePath("/matches");
  revalidatePath("/");
  if (startingLineError) {
    return { success: true, warning: `Session started, but there was a problem: ${startingLineError}` };
  }
  return { success: true };
}

/**
 * Shuffle everyone who said "I'm going" (and anyone already pre-queued) into the
 * starting line, so tapping first is no head start. Returns an error message, or null.
 */
async function buildStartingLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<string | null> {
  const [rsvpRes, queueRes] = await Promise.all([
    supabase.from("session_rsvps").select("player_id").eq("session_id", sessionId),
    supabase
      .from("queue_entries")
      .select("id, player_id, group_id")
      .eq("session_id", sessionId)
      .not("status", "in", "(left,playing)"),
  ]);
  if (rsvpRes.error) return rsvpRes.error.message;
  if (queueRes.error) return queueRes.error.message;

  // Only active player accounts are added; the system admin never plays.
  const rsvpIds = (rsvpRes.data || []).map((r) => r.player_id);
  let goingPlayerIds: string[] = [];
  if (rsvpIds.length > 0) {
    const { data: players, error: playersError } = await supabase
      .from("profiles")
      .select("id, email, is_active")
      .in("id", rsvpIds);
    if (playersError) return playersError.message;
    goingPlayerIds = (players || [])
      .filter((p) => p.is_active && p.email?.toLowerCase() !== "admin@dctechmicro.com")
      .map((p) => p.id);
  }

  const now = new Date();
  const plan = planStartingLine({ goingPlayerIds, existing: queueRes.data || [], now });

  if (plan.add.length > 0) {
    const { error: insertError } = await supabase.from("queue_entries").insert(
      plan.add.map((a) => ({ session_id: sessionId, player_id: a.playerId, status: "waiting" as const, joined_at: a.joinedAt }))
    );
    if (insertError) return insertError.message;

    // Being in line counts as checked in, same as joining the queue yourself.
    await supabase.from("session_checkins").upsert(
      plan.add.map((a) => ({ session_id: sessionId, player_id: a.playerId, status: "checked_in" as const, checkin_time: now.toISOString() })),
      { onConflict: "session_id,player_id" }
    );
  }

  for (const r of plan.reorder) {
    const { error: updateError } = await supabase.from("queue_entries").update({ joined_at: r.joinedAt }).eq("id", r.id);
    if (updateError) return updateError.message;
  }
  return null;
}

export async function checkInToSession(sessionId: string, playerId?: string) {
  const supabase = await createClient();
  let targetPlayerId = playerId;

  if (!targetPlayerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required to check in." };
    targetPlayerId = user.id;
  }

  // Checking in puts you in the queue, which only opens once the session is live.
  const { data: sessionRow } = await supabase.from("sessions").select("status").eq("id", sessionId).maybeSingle();
  const closed = queueClosedReason(sessionRow?.status);
  if (closed) return { error: closed };

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

  const checkedInId = targetPlayerId;
  recordSessionEvent(async () => {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) return null;
    return {
      sessionId,
      type: "checked_in",
      actorId: caller.id,
      actorRole: caller.id === checkedInId ? "self" : "admin",
      subjectIds: [checkedInId],
    };
  });

  // Also auto-enter the waiting queue if not already queued
  const { data: existingQueue } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId)
    .neq("status", "left") // waiting, called, playing or on_break
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to check out." };
  }

  let targetPlayerId = playerId;
  if (!targetPlayerId) {
    targetPlayerId = user.id;
  }

  // If checking out someone else, ensure caller has admin privileges
  if (targetPlayerId !== user.id) {
    const auth = await requireAdminUser();
    if (auth.error) {
      return { error: auth.error };
    }
  }

  // 1. Mark session check-in as checked_out
  const { error: checkinError } = await supabase
    .from("session_checkins")
    .update({ status: "checked_out" })
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId);

  if (checkinError) {
    return { error: checkinError.message };
  }

  recordSessionEvent({
    sessionId,
    type: "checked_out",
    actorId: user.id,
    actorRole: targetPlayerId === user.id ? "self" : "admin",
    subjectIds: [targetPlayerId],
  });

  // 2. Automatically remove player from the active queue so they are not matched or called
  const { error: queueError } = await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId)
    .not("status", "in", "(playing,left)"); // waiting, called or on_break

  if (queueError) {
    console.error("Failed to remove player from queue on check-out:", queueError.message);
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/queue");
  revalidatePath("/");
  return { success: true };
}
