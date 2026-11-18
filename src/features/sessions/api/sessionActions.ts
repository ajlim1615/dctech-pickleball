"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LINE_STATUSES } from "@/features/queue/constants/queueStatuses";
import { closeSession } from "@/features/sessions/server/closeSession";
import { insertQueueEntries } from "@/features/queue/server/insertQueueEntries";
import { parsePHTToISO } from "@/lib/timezone";
import { logSessionEvent, recordSessionEvent } from "@/features/activity/server/logEvent";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadQueueLimits } from "@/features/queue/server/queueLimitsData";
import { REJOIN_USED_MESSAGE, canRejoin } from "@/features/queue/utils/queueLimits";
import { pickArrived, planStartingLine } from "@/features/queue/startingLine";
import { queueClosedReason } from "@/features/queue/utils/queueOpen";
import { MATCH_COURT } from "@/features/matches/utils/queryShapes";
import type { Session, SessionCheckin, SessionStatus } from "@/types";

const COMPLETED_SESSIONS_LIMIT = 50;

const readSessions = cache(async (): Promise<Session[]> => {
  const supabase = await createClient();
  const [openRes, completedRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .in("status", ["active", "scheduled"])
      .order("start_time", { ascending: true }),
    supabase
      .from("sessions")
      .select("*")
      .not("status", "in", "(active,scheduled)")
      .order("start_time", { ascending: false })
      .limit(COMPLETED_SESSIONS_LIMIT),
  ]);

  if (openRes.error && completedRes.error) return [];
  const combined = [...(openRes.data ?? []), ...(completedRes.data ?? [])] as Session[];
  return combined.sort((a, b) => a.start_time.localeCompare(b.start_time));
});

export async function getSessions(): Promise<Session[]> {
  return readSessions();
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
      ${MATCH_COURT} (id, name, surface_type),
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
import { isGuestProfile } from "@/features/admin/utils/playerDirectory";
import { GUEST_RANKED_MESSAGE, canEnterSession } from "@/features/sessions/utils/guestRules";
import { DEFAULT_COURT_COUNT } from "@/lib/constants";
import { setRentedCourtCount } from "@/features/admin/api/adminActions";

export async function createSession(formData: FormData) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const rawTitle = formData.get("title") as string;
  const rawDescription = formData.get("description") as string;
  const rawLocation = (formData.get("location") as string) || "DCTECH Sports Arena";
  const rawVenueId = (formData.get("venueId") as string | null)?.trim() || null;
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
    venue_id: rawVenueId,
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

/**
 * `hereIds`: on a first start, the going players the admin ticked as at the courts.
 * Only they are shuffled into the line; the rest stay "going" and join when they
 * arrive. Left out, everyone going starts in line.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  options: { hereIds?: string[] } = {}
) {
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

  if (status === "completed" || status === "cancelled") {
    // One transaction: this session's unfinished games are abandoned (not scored),
    // only their courts are freed, and its line is emptied.
    const closeError = await closeSession(supabase, sessionId, status);
    if (closeError) return { error: closeError };
  } else {
    if (status === "active") {
      // One live session at a time: close any other live one properly, so its games,
      // courts and line don't linger.
      const { data: others } = await supabase
        .from("sessions")
        .select("id")
        .eq("status", "active")
        .neq("id", sessionId);
      for (const other of others || []) {
        const closeError = await closeSession(supabase, other.id, "completed");
        if (closeError) return { error: closeError };
        recordSessionEvent({
          sessionId: other.id,
          type: "session_ended",
          actorId: auth.context!.userId,
          actorRole: "admin",
        });
      }
    }

    const { error } = await supabase
      .from("sessions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) return { error: error.message };
  }

  let startingLineError: string | null = null;
  if (isFirstStart) {
    startingLineError = await buildStartingLine(supabase, sessionId, options.hereIds);
  }

  if (status === "active" || status === "completed") {
    recordSessionEvent({
      sessionId,
      type: status === "active" ? "session_started" : "session_ended",
      actorId: auth.context!.userId,
      actorRole: "admin",
    });
  }

  // The arena runs on this session's own court count (older sessions: the default).
  // Any other live session was closed above, so no court is mid-game.
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
  revalidatePath("/matches");
  revalidatePath("/");
  if (startingLineError) {
    return { success: true, warning: `Session started, but there was a problem: ${startingLineError}` };
  }
  return { success: true };
}

/**
 * Shuffle everyone who said "I'm going" (or, when the admin picked, only those
 * ticked as here) and anyone already pre-queued into the starting line, so tapping
 * first is no head start. Returns an error message, or null.
 */
async function buildStartingLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  hereIds?: string[]
): Promise<string | null> {
  const [rsvpRes, queueRes, sessionRes] = await Promise.all([
    supabase.from("session_rsvps").select("player_id").eq("session_id", sessionId),
    supabase
      .from("queue_entries")
      .select("id, player_id, group_id")
      .eq("session_id", sessionId)
      .in("status", LINE_STATUSES),
    supabase.from("sessions").select("description").eq("id", sessionId).maybeSingle(),
  ]);
  if (rsvpRes.error) return rsvpRes.error.message;
  const isRanked = parseSessionMetadata(sessionRes.data?.description).isRanked;
  if (queueRes.error) return queueRes.error.message;

  // Only active player accounts are added; the system admin never plays, and
  // guests only play casual sessions.
  const rsvpIds = pickArrived(
    (rsvpRes.data || []).map((r) => r.player_id),
    Array.isArray(hereIds) ? hereIds.filter((id): id is string => typeof id === "string") : undefined
  );
  let goingPlayerIds: string[] = [];
  if (rsvpIds.length > 0) {
    const { data: players, error: playersError } = await supabase
      .from("profiles")
      .select("id, email, is_active, is_guest")
      .in("id", rsvpIds);
    if (playersError) return playersError.message;
    goingPlayerIds = (players || [])
      .filter((p) => p.is_active && p.email?.toLowerCase() !== "admin@dctechmicro.com" && canEnterSession(p, isRanked))
      .map((p) => p.id);
  }

  const now = new Date();
  const plan = planStartingLine({ goingPlayerIds, existing: queueRes.data || [], now });

  if (plan.add.length > 0) {
    const added = await insertQueueEntries(
      supabase,
      plan.add.map((a) => ({ session_id: sessionId, player_id: a.playerId, status: "waiting" as const, joined_at: a.joinedAt }))
    );
    if (added.error) return added.error;

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

  const { data: { user: me } } = await supabase.auth.getUser();
  if (!me) return { error: "Authentication required to check in." };
  if (!targetPlayerId) {
    targetPlayerId = me.id;
  } else if (targetPlayerId !== me.id) {
    // Checking someone else in (and into the line) is an admin action.
    const auth = await requireAdminUser();
    if (auth.error) return { error: auth.error };
  }

  // Checking in puts you in the queue, which only opens once the session is live.
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("status, description")
    .eq("id", sessionId)
    .maybeSingle();
  const closed = queueClosedReason(sessionRow?.status);
  if (closed) return { error: closed };

  // One rejoin per session: a player who left twice needs an admin to check them back in.
  {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (caller && caller.id === targetPlayerId) {
      if (!canRejoin(await loadQueueLimits(supabase, sessionId, targetPlayerId))) {
        return { error: REJOIN_USED_MESSAGE };
      }
    }
  }

  // Guard: Root system admin cannot check in to play, and guests cannot enter Ranked sessions
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, is_guest")
    .eq("id", targetPlayerId)
    .single();
  if (profile?.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account (admin@dctechmicro.com) is a non-playing administrator and cannot check in to play." };
  }
  if (profile && isGuestProfile(profile) && parseSessionMetadata(sessionRow?.description).isRanked) {
    return { error: GUEST_RANKED_MESSAGE };
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

  // Also enter the line; already in it (waiting, on court or on a break) is skipped.
  await insertQueueEntries(createAdminClient(), [
    { session_id: sessionId, player_id: targetPlayerId, status: "waiting" },
  ]);

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
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

  // 2. Automatically remove player from the active queue so they are not matched or called
  const { data: removed, error: queueError } = await createAdminClient()
    .from("queue_entries")
    .update({ status: "left" })
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId)
    .in("status", LINE_STATUSES)
    .select("id");

  if (queueError) {
    console.error("Failed to remove player from queue on check-out:", queueError.message);
  }

  const isSelf = targetPlayerId === user.id;
  const leftLine = Boolean(removed && removed.length > 0);
  const checkoutEvent = {
    sessionId,
    type: "checked_out" as const,
    actorId: user.id,
    actorRole: isSelf ? ("self" as const) : ("admin" as const),
    subjectIds: [targetPlayerId],
    // A self check-out that took the player out of line uses their one rejoin.
    details: { left_line: leftLine },
  };
  if (isSelf && leftLine) {
    await logSessionEvent(createAdminClient() as unknown as Parameters<typeof logSessionEvent>[0], checkoutEvent);
  } else {
    recordSessionEvent(checkoutEvent);
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true };
}
