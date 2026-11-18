"use server";

import { createClient } from "@/lib/supabase/server";
import { LINE_STATUSES } from "@/features/queue/constants/queueStatuses";
import { insertQueueEntries, staggeredJoinTimes } from "@/features/queue/server/insertQueueEntries";
import type { QueueEntry, QueueEntryWithPlayer, QueueStatus } from "@/types";
import { decide, type LineEntry } from "@/features/queue/matchmaking";
import { parseSessionMetadata } from "@/lib/utils";
import { isGuestProfile } from "@/features/admin/utils/playerDirectory";
import { GUEST_RANKED_MESSAGE, canEnterSession } from "@/features/sessions/utils/guestRules";
import { holdMessage, loadOpenCourtIds, loadSessionHistory, reservedAbove } from "@/features/queue/api/matchmakingData";
import { isRootSystemAdmin, requireAdminUser } from "@/lib/security/authGuard";
import { gameStateErrorMessage } from "@/features/matches/utils/gameStateErrors";
import { withLineRetry } from "@/features/queue/utils/lineRetry";
import type { Decision } from "@/features/queue/matchmaking";
import { logSessionEvent, recordSessionEvent } from "@/features/activity/server/logEvent";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadQueueLimits } from "@/features/queue/server/queueLimitsData";
import { createPlayerAccount } from "@/features/players/server/createPlayer";
import { RATING_RULES } from "@/features/rankings/ratingConfig";
import {
  BREAK_USED_MESSAGE,
  NO_LIMITS_USED,
  REJOIN_USED_MESSAGE,
  canRejoin,
  canTakeBreak,
  type QueueLimits,
} from "@/features/queue/utils/queueLimits";
import { queueClosedReason } from "@/features/queue/utils/queueOpen";
import { afterLineChange } from "@/features/queue/server/afterLineChange";
import { getUpNext, sendUpNextToCourt } from "@/features/queue/api/upNextActions";
import { markNoShow } from "@/features/courts/api/courtPlayerActions";

type HoldKind = Extract<Decision, { hold: unknown }>["hold"];

export async function getQueueForSession(sessionId?: string): Promise<QueueEntryWithPlayer[]> {
  const supabase = await createClient();

  let query = supabase
    .from("queue_entries")
    .select(`
      *,
      player:profiles (
        id,
        full_name,
        display_name,
        skill_rating
      )
    `)
    .in("status", LINE_STATUSES)
    .order("joined_at", { ascending: true });

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data as unknown as QueueEntryWithPlayer[];
}

export async function joinQueue(params: {
  sessionId: string;
  partnerId?: string;
  guestName?: string;
  preferredCourtId?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required to join queue." };
  }

  // Guard: Root system admin cannot join the player queue
  if (user.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account (admin@dctechmicro.com) is an administrative profile and cannot join the paddle queue." };
  }

  // The line opens when the session goes live. Before that, "I'm going" is how to
  // get in: everyone going is shuffled into the starting line, so there is no pre-queue.
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("status, description")
    .eq("id", params.sessionId)
    .maybeSingle();

  const closed = queueClosedReason(sessionRow?.status);
  if (closed) return { error: closed };

  // Partners (a coworker or guest on your team) only when the admin allowed it for this session.
  if ((params.partnerId || params.guestName) && !parseSessionMetadata(sessionRow?.description).allowPartners) {
    return { error: "This session is solo only: join on your own and the game mode makes the teams." };
  }

  // Guests (non-employees) play casual sessions only, including as someone's partner.
  const isRankedSession = parseSessionMetadata(sessionRow?.description).isRanked;
  if (params.guestName && isRankedSession) {
    return { error: GUEST_RANKED_MESSAGE };
  }
  if (params.partnerId) {
    const { data: partner } = await supabase
      .from("profiles")
      .select("id, email, is_guest, is_active")
      .eq("id", params.partnerId)
      .maybeSingle();
    if (!partner || !partner.is_active || isRootSystemAdmin(partner.email)) {
      return { error: "That partner can't play right now. Pick someone else." };
    }
    if (!canEnterSession(partner, isRankedSession)) {
      return { error: GUEST_RANKED_MESSAGE };
    }
  }

  // One rejoin per session: after leaving twice, only an admin can add the player back.
  if (!canRejoin(await loadQueueLimits(supabase, params.sessionId, user.id))) {
    return { error: REJOIN_USED_MESSAGE };
  }

  const groupId = (params.partnerId || params.guestName) ? crypto.randomUUID() : null;
  // Players can't write the line directly (the database only lets admins); this
  // action has checked the rules above, so it writes with the service key.
  const admin = createAdminClient();

  // Automatically record session check-in attendance
  try {
    await supabase.from("session_checkins").upsert(
      {
        session_id: params.sessionId,
        player_id: user.id,
        status: "checked_in",
        checkin_time: new Date().toISOString(),
      },
      { onConflict: "session_id,player_id" }
    );
  } catch (e) {
    console.error("Auto session checkin failed:", e);
  }

  // Join the line. Already in it (a double tap, or checked in a moment ago) is fine:
  // the database keeps one active entry per player, and that row is skipped.
  const joined = await insertQueueEntries(admin, [
    {
      session_id: params.sessionId,
      player_id: user.id,
      group_id: groupId,
      status: "waiting",
      target_court_id: params.preferredCourtId || null,
    },
  ]);
  if (joined.error) {
    return { error: joined.error };
  }

  // If doubles pair with a registered coworker
  if (params.partnerId) {
    await admin.from("session_checkins").upsert(
      {
        session_id: params.sessionId,
        player_id: params.partnerId,
        status: "checked_in",
        checkin_time: new Date().toISOString(),
      },
      { onConflict: "session_id,player_id" }
    );

    await insertQueueEntries(admin, [
      {
        session_id: params.sessionId,
        player_id: params.partnerId,
        group_id: groupId,
        status: "waiting",
        target_court_id: params.preferredCourtId || null,
      },
    ]);
  } else if (params.guestName) {
    // A guest needs a player record (and so an account that can't sign in).
    const guestName = params.guestName.trim().slice(0, 60);
    const guest = await createPlayerAccount({
      fullName: guestName.includes("(Guest)") ? guestName : `${guestName} (Guest)`,
      displayName: guestName,
      rating: RATING_RULES.start,
      isGuest: true,
    });
    if (guest.error || !guest.id) {
      return { error: `You joined, but your guest couldn't be added: ${guest.error ?? "unknown error"}` };
    }

    await insertQueueEntries(admin, [
      {
        session_id: params.sessionId,
        player_id: guest.id,
        group_id: groupId,
        status: "waiting",
        target_court_id: params.preferredCourtId || null,
      },
    ]);
  }

  recordSessionEvent({
    sessionId: params.sessionId,
    type: "joined_queue",
    actorId: user.id,
    actorRole: "self",
    subjectIds: [user.id],
    details: { partnerId: params.partnerId ?? null, guestName: params.guestName ?? null },
  });

  await afterLineChange(params.sessionId, ["/sessions"]);
  return { success: true };
}

export async function bulkAddPlayersToQueue(sessionId: string, playerIds: string[]) {
  // Admins only: this skips the line rules (rejoin limit) and is logged as an admin action.
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  if (!playerIds || playerIds.length === 0) {
    return { error: "Please select at least one employee." };
  }

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("status, description")
    .eq("id", sessionId)
    .maybeSingle();
  const closed = queueClosedReason(sessionRow?.status);
  if (closed) return { error: closed };

  const isRankedSession = parseSessionMetadata(sessionRow?.description).isRanked;

  // Exclude system admin (and guests in Ranked sessions) from bulk queue
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, is_guest")
    .in("id", playerIds);
  const blockedIds = new Set(
    profiles
      ?.filter(
        (p) =>
          p.email?.toLowerCase() === "admin@dctechmicro.com" ||
          (isRankedSession && isGuestProfile(p))
      )
      .map((p) => p.id) || []
  );
  const validPlayerIds = playerIds.filter((id) => !blockedIds.has(id));
  if (validPlayerIds.length === 0) {
    return { error: isRankedSession ? GUEST_RANKED_MESSAGE : "No eligible players selected." };
  }

  // Get currently active queue entries to avoid duplicates
  const { data: currentEntries } = await supabase
    .from("queue_entries")
    .select("player_id")
    .eq("session_id", sessionId)
    .neq("status", "left"); // waiting, called, playing or on_break

  const alreadyQueued = new Set(currentEntries?.map((e) => e.player_id) || []);
  const toAdd = validPlayerIds.filter((id) => !alreadyQueued.has(id));

  if (toAdd.length === 0) {
    return { success: true, count: 0, message: "All selected employees are already queued." };
  }

  // Auto check-in to session
  const checkinRecords = toAdd.map((playerId) => ({
    session_id: sessionId,
    player_id: playerId,
    status: "checked_in" as const,
    checkin_time: new Date().toISOString(),
  }));
  await supabase.from("session_checkins").upsert(checkinRecords, { onConflict: "session_id,player_id" });

  // Into the line in the order picked (1 ms apart), skipping anyone who joined meanwhile.
  const joinTimes = staggeredJoinTimes(toAdd.length, new Date());
  const added = await insertQueueEntries(
    supabase,
    toAdd.map((playerId, i) => ({
      session_id: sessionId,
      player_id: playerId,
      status: "waiting" as const,
      joined_at: joinTimes[i],
    }))
  );

  if (added.error) {
    return { error: added.error };
  }

  recordSessionEvent({
    sessionId,
    type: "players_added",
    actorId: user!.id,
    actorRole: "admin",
    subjectIds: toAdd,
    details: { count: toAdd.length },
  });

  await afterLineChange(sessionId);
  return { success: true, count: added.inserted };
}

export async function leaveQueue(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  // Players can't write the line directly; the service key writes only their own entry.
  const { data: removed, error } = await createAdminClient()
    .from("queue_entries")
    .update({ status: "left" })
    .eq("session_id", sessionId)
    .eq("player_id", user.id)
    .in("status", LINE_STATUSES)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  // Only a real leave counts toward the one-rejoin limit, and it is written before
  // replying so a quick rejoin always sees it.
  if (removed && removed.length > 0) {
    await logSessionEvent(createAdminClient() as unknown as Parameters<typeof logSessionEvent>[0], {
      sessionId,
      type: "left_queue",
      actorId: user.id,
      actorRole: "self",
      subjectIds: [user.id],
    });
  }

  await afterLineChange(sessionId);
  return { success: true };
}

export async function adminRemovePlayerFromQueue(
  sessionId: string,
  queueEntryId: string,
  alsoCheckOut: boolean = false
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Only administrators can remove players from the queue." };
  }

  // Who's being removed (for checking out and for the activity log)
  const { data: removedEntry } = await supabase
    .from("queue_entries")
    .select("player_id")
    .eq("id", queueEntryId)
    .maybeSingle();
  const targetPlayerId: string | null = removedEntry?.player_id || null;

  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("id", queueEntryId)
    .eq("session_id", sessionId);

  if (error) {
    return { error: error.message };
  }

  if (alsoCheckOut && targetPlayerId) {
    await supabase
      .from("session_checkins")
      .update({ status: "checked_out" })
      .eq("session_id", sessionId)
      .eq("player_id", targetPlayerId);
  }

  if (targetPlayerId) {
    recordSessionEvent({
      sessionId,
      type: "removed_from_queue",
      actorId: user.id,
      actorRole: "admin",
      subjectIds: [targetPlayerId],
      details: { checkedOut: alsoCheckOut },
    });
  }

  await afterLineChange(sessionId, ["/sessions"]);
  return { success: true };
}

export async function bumpPlayerInQueue(sessionId: string, queueEntryId: string, positions: number = 4) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Permission denied: Only administrators can reorder queue positions." };
  }

  // Get current list of waiting entries
  const { data: entries, error } = await supabase
    .from("queue_entries")
    .select("id, player_id, joined_at")
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .order("joined_at", { ascending: true });

  if (error || !entries || entries.length === 0) {
    return { error: "Queue is empty or unavailable." };
  }

  const currentIndex = entries.findIndex((e) => e.id === queueEntryId);
  if (currentIndex === -1) {
    return { error: "Player entry not found in active waiting queue." };
  }

  // Move back by `positions` (e.g. 4 slots = 1 full rack)
  const targetIndex = Math.min(entries.length - 1, currentIndex + positions);
  const targetEntry = entries[targetIndex];

  // Set new joined_at timestamp 1000ms after the target entry so it sits right behind it
  const newTimestamp = new Date(new Date(targetEntry.joined_at).getTime() + 1000).toISOString();

  const { error: updateError } = await supabase
    .from("queue_entries")
    .update({ joined_at: newTimestamp })
    .eq("id", queueEntryId);

  if (updateError) {
    return { error: updateError.message };
  }

  const moved = entries[currentIndex];
  recordSessionEvent({
    sessionId,
    type: "moved_in_queue",
    actorId: user.id,
    actorRole: "admin",
    subjectIds: [moved.player_id],
    details: { positions: -(targetIndex - currentIndex) },
  });

  await afterLineChange(sessionId);
  return { success: true };
}

export async function swapQueuePlayers(sessionId: string, entryId1: string, entryId2: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Permission denied: Only administrators can swap player spots." };
  }

  const { data: entries, error } = await supabase
    .from("queue_entries")
    .select("id, joined_at, player_id")
    .in("id", [entryId1, entryId2]);

  if (error || !entries || entries.length !== 2) {
    return { error: "Could not find both player entries to swap." };
  }

  const time1 = entries[0].joined_at;
  const time2 = entries[1].joined_at;

  await supabase.from("queue_entries").update({ joined_at: time2 }).eq("id", entries[0].id);
  await supabase.from("queue_entries").update({ joined_at: time1 }).eq("id", entries[1].id);

  recordSessionEvent({
    sessionId,
    type: "players_swapped",
    actorId: user.id,
    actorRole: "admin",
    subjectIds: [entries[0].player_id, entries[1].player_id],
    details: { kind: "places" },
  });

  await afterLineChange(sessionId);
  return { success: true };
}

export async function substituteQueuePlayer(sessionId: string, queueEntryId: string, newPlayerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Permission denied: Only administrators can substitute players." };
  }

  // Auto check in new player to session
  await supabase.from("session_checkins").upsert(
    {
      session_id: sessionId,
      player_id: newPlayerId,
      status: "checked_in",
      checkin_time: new Date().toISOString(),
    },
    { onConflict: "session_id,player_id" }
  );

  const { data: replaced } = await supabase
    .from("queue_entries")
    .select("player_id")
    .eq("id", queueEntryId)
    .maybeSingle();

  const { error } = await supabase
    .from("queue_entries")
    .update({ player_id: newPlayerId })
    .eq("id", queueEntryId);

  if (error) {
    return { error: error.message };
  }

  recordSessionEvent({
    sessionId,
    type: "players_swapped",
    actorId: user.id,
    actorRole: "admin",
    subjectIds: [replaced?.player_id, newPlayerId].filter((id): id is string => Boolean(id)),
    details: { kind: "substitute", out: replaced?.player_id ?? null, in: newPlayerId },
  });

  await afterLineChange(sessionId);
  return { success: true };
}

export async function callNextUp(
  sessionId: string,
  courtId: string,
  // Kept for existing callers; every style plays doubles, so the decision always picks four.
  _count: number = 4,
  options: { force?: boolean } = {}
) {
  // Only admins put games on court; start_match checks the same in the database.
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  // 1. Matching style from the session configuration
  const { data: sessionData } = await supabase
    .from("sessions")
    .select("description, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionData && sessionData.status !== "active") {
    return { error: gameStateErrorMessage("session_not_active") };
  }

  const { matchingMode: matchingStyle, skillSpread } = parseSessionMetadata(sessionData?.description);

  // 2. This session's completed games and the ladder of open courts
  const [history, courts] = await Promise.all([
    loadSessionHistory(supabase, sessionId),
    loadOpenCourtIds(supabase),
  ]);

  type CallAttempt =
    | { ok: false; error: string; hold?: HoldKind; code?: string }
    | { ok: true; matchId: string; teamA: string[]; teamB: string[] };

  // 3. Read the line, decide, start the game. If the line changed in between
  //    (someone else called a player first), read and decide once more.
  const result = await withLineRetry(
    async (): Promise<CallAttempt> => {
      const { data: allWaitingEntries, error: qErr } = await supabase
        .from("queue_entries")
        .select(`
          id,
          player_id,
          group_id,
          joined_at,
          player:profiles (
            id,
            skill_rating
          )
        `)
        .eq("session_id", sessionId)
        .eq("status", "waiting")
        .order("joined_at", { ascending: true });

      if (qErr || !allWaitingEntries || allWaitingEntries.length === 0) {
        return { ok: false, error: "No waiting players currently in queue." };
      }

      const line: LineEntry[] = allWaitingEntries.map((e) => ({
        playerId: e.player_id,
        rating: (e.player as unknown as { skill_rating: number | null } | null)?.skill_rating ?? null,
        pairId: e.group_id,
      }));
      const decision = decide({
        style: matchingStyle,
        line,
        history,
        court: courtId,
        courts,
        settings: { skillSpread },
        random: Math.random,
        force: options.force,
      });
      if ("hold" in decision) {
        let message = holdMessage(decision, skillSpread);
        if (matchingStyle === "king_queen" && decision.hold === "not_enough_players") {
          // Players saved for a court above are waiting but cannot be used here.
          message = holdMessage(decision, skillSpread, reservedAbove(history, line, courts, courtId));
        }
        return { ok: false, error: message, hold: decision.hold };
      }

      // One transaction: checks the court and players, claims them, creates the game.
      const { data, error } = await supabase.rpc("start_match", {
        p_session_id: sessionId,
        p_court_id: courtId,
        p_team_a: decision.teamA,
        p_team_b: decision.teamB,
        p_from_queue: true,
      });
      if (error) {
        console.error("start_match failed:", error.message);
        return { ok: false, error: gameStateErrorMessage(undefined) };
      }
      const out = data as { match_id?: string; error?: string } | null;
      if (!out?.match_id) return { ok: false, error: gameStateErrorMessage(out?.error), code: out?.error };
      return { ok: true, matchId: out.match_id, teamA: decision.teamA, teamB: decision.teamB };
    },
    (attempt) => !attempt.ok && attempt.code === "line_changed"
  );

  if (!result.ok) {
    return result.hold ? { error: result.error, hold: result.hold } : { error: result.error };
  }
  const { matchId, teamA, teamB } = result;

  // Logged as the signed-in admin who called the group.
  recordSessionEvent(async () => {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) return null;
    const { data: court } = await supabase.from("courts").select("name").eq("id", courtId).maybeSingle();
    return {
      sessionId,
      type: "game_started",
      actorId: caller.id,
      actorRole: "admin",
      subjectIds: [...teamA, ...teamB],
      courtId,
      matchId,
      details: { courtName: court?.name ?? null, teamA, teamB },
    };
  });

  await afterLineChange(sessionId, [`/courts/${courtId}/monitor`]);
  return { success: true, count: teamA.length + teamB.length, matchId };
}

/**
 * "Fill all courts": starts the Up Next cards in order on every open court (a card
 * bound to a court only on that court), until courts or cards run out.
 */
export async function fillOpenCourts(sessionId: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const [{ data: openCourts }, cards] = await Promise.all([
    supabase
      .from("courts")
      .select("id")
      .eq("status", "available")
      .is("current_match_id", null)
      .order("sort_order", { ascending: true }),
    getUpNext(sessionId),
  ]);
  if (!openCourts || openCourts.length === 0) return { error: "No open courts right now." };

  const freeIds = openCourts.map((c) => c.id);
  const ready = cards.filter((c) => c.teamA.length === c.perSide && c.teamB.length === c.perSide);
  let filled = 0;
  let lastError: string | undefined;
  for (const courtId of freeIds) {
    const card = ready.find((c) => c.targetCourtId === courtId) ?? ready.find((c) => c.targetCourtId === null);
    if (!card) continue;
    ready.splice(ready.indexOf(card), 1);
    const res = await sendUpNextToCourt(sessionId, card.id, courtId);
    if ("error" in res) lastError = res.error;
    else filled++;
  }

  if (filled === 0) return { error: lastError || "No Up Next match is ready to start." };
  return { success: true, filled, remainingOpen: freeIds.length - filled };
}

/** The signed-in player's breaks and leaves used in this session (one break, one rejoin). */
export async function getMyQueueLimits(sessionId: string): Promise<QueueLimits> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NO_LIMITS_USED;
  return loadQueueLimits(supabase, sessionId, user.id);
}

/**
 * Puts a player on a break (skipped by "Call next" but keeps their place) or brings
 * them back. Players change their own entry; admins can change anyone's. Players get
 * one break per session; breaks an admin sets (like a no-show swap) don't count.
 */
export async function setQueueBreak(sessionId: string, onBreak: boolean, playerId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to change your queue status." };

  let targetPlayerId = user.id;
  if (playerId && playerId !== user.id) {
    const auth = await requireAdminUser();
    if (auth.error) return { error: "Only admins can put other players on a break." };
    targetPlayerId = playerId;
  }
  const isSelf = targetPlayerId === user.id;

  if (onBreak && isSelf && !canTakeBreak(await loadQueueLimits(supabase, sessionId, user.id))) {
    return { error: BREAK_USED_MESSAGE };
  }

  const { data: entry } = await supabase
    .from("queue_entries")
    .select("id, status")
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId)
    .in("status", LINE_STATUSES)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!entry) {
    return { error: "You're not in the queue. Check in to join it." };
  }

  // joined_at is untouched, so coming back keeps the same place in line.
  // Entry found above for this player (or one an admin may change): written with the service key.
  const { error } = await createAdminClient()
    .from("queue_entries")
    .update({ status: onBreak ? "on_break" : "waiting" })
    .eq("id", entry.id);

  if (error) {
    return {
      error: error.message.includes("on_break")
        ? "Breaks aren't set up yet: apply the queue_on_break database migration."
        : error.message,
    };
  }

  const breakEvent = {
    sessionId,
    type: onBreak ? ("break_started" as const) : ("break_ended" as const),
    actorId: user.id,
    actorRole: isSelf ? ("self" as const) : ("admin" as const),
    subjectIds: [targetPlayerId],
  };
  if (onBreak && isSelf) {
    // Written before replying: this row is what limits a player to one break.
    await logSessionEvent(createAdminClient() as unknown as Parameters<typeof logSessionEvent>[0], breakEvent);
  } else {
    recordSessionEvent(breakEvent);
  }

  await afterLineChange(sessionId);
  return { success: true };
}

/** No-show: the next person in line comes in; the no-show goes on a break. Kept for existing callers. */
export async function swapNoShow(matchId: string, noShowPlayerId: string) {
  const res = await markNoShow(matchId, noShowPlayerId);
  if ("error" in res) return { error: res.error };
  const supabase = await createClient();
  const { data: replacementProfile } = await supabase
    .from("profiles")
    .select("full_name, display_name")
    .eq("id", res.replacementId ?? "")
    .maybeSingle();
  return {
    success: true as const,
    changeId: res.changeId,
    replacementName: replacementProfile?.full_name || replacementProfile?.display_name || "The next player",
  };
}
