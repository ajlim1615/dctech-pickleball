"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntry, QueueEntryWithPlayer, QueueStatus } from "@/types";
import { decide, type LineEntry } from "@/features/queue/matchmaking";
import { parseSessionMetadata } from "@/lib/utils";
import { CALL_WINDOW_LIMIT, holdMessage, loadOpenCourtIds, loadSessionHistory } from "@/features/queue/api/matchmakingData";
import { isRootSystemAdmin, requireAdminUser } from "@/lib/security/authGuard";
import { canSwapNoShow, claimFirstAvailable, NO_SHOW_WINDOW_MINUTES, pickReplacement } from "@/features/queue/utils/noShow";
import { recordSessionEvent } from "@/features/activity/server/logEvent";

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
        avatar_url,
        skill_rating
      )
    `)
    .not("status", "in", "(playing,left)") // waiting, called or on_break
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

  const groupId = (params.partnerId || params.guestName) ? crypto.randomUUID() : null;

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

  // Check if player is already waiting/called
  const { data: existingQueue } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("session_id", params.sessionId)
    .eq("player_id", user.id)
    .not("status", "in", "(playing,left)") // waiting, called or on_break
    .maybeSingle();

  if (!existingQueue) {
    // Insert current player
    const { error: userError } = await supabase.from("queue_entries").insert({
      session_id: params.sessionId,
      player_id: user.id,
      group_id: groupId,
      status: "waiting",
      target_court_id: params.preferredCourtId || null,
    });

    if (userError) {
      return { error: userError.message };
    }
  }

  // If doubles pair with a registered coworker
  if (params.partnerId) {
    await supabase.from("session_checkins").upsert(
      {
        session_id: params.sessionId,
        player_id: params.partnerId,
        status: "checked_in",
        checkin_time: new Date().toISOString(),
      },
      { onConflict: "session_id,player_id" }
    );

    const { data: existingPartnerQueue } = await supabase
      .from("queue_entries")
      .select("id")
      .eq("session_id", params.sessionId)
      .eq("player_id", params.partnerId)
      .not("status", "in", "(playing,left)") // waiting, called or on_break
      .maybeSingle();

    if (!existingPartnerQueue) {
      await supabase.from("queue_entries").insert({
        session_id: params.sessionId,
        player_id: params.partnerId,
        group_id: groupId,
        status: "waiting",
        target_court_id: params.preferredCourtId || null,
      });
    }
  } else if (params.guestName) {
    // Fast create guest profile
    const guestId = crypto.randomUUID();
    const guestEmail = `guest_${Date.now()}@guest.local`;
    await supabase.from("profiles").insert({
      id: guestId,
      email: guestEmail,
      full_name: params.guestName.includes("(Guest)") ? params.guestName : `${params.guestName} (Guest)`,
      display_name: params.guestName,
      role: "player",
      skill_rating: 3.0,
      is_active: true,
    });

    await supabase.from("queue_entries").insert({
      session_id: params.sessionId,
      player_id: guestId,
      group_id: groupId,
      status: "waiting",
      target_court_id: params.preferredCourtId || null,
    });
  }

  recordSessionEvent({
    sessionId: params.sessionId,
    type: "joined_queue",
    actorId: user.id,
    actorRole: "self",
    subjectIds: [user.id],
    details: { partnerId: params.partnerId ?? null, guestName: params.guestName ?? null },
  });

  revalidatePath("/queue");
  revalidatePath(`/sessions/${params.sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true };
}

export async function bulkAddPlayersToQueue(sessionId: string, playerIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  if (!playerIds || playerIds.length === 0) {
    return { error: "Please select at least one employee." };
  }

  // Exclude system admin from bulk queue
  const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", playerIds);
  const adminIds = new Set(profiles?.filter((p) => p.email?.toLowerCase() === "admin@dctechmicro.com").map((p) => p.id) || []);
  const validPlayerIds = playerIds.filter((id) => !adminIds.has(id));

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

  // Insert queue entries
  const queueRecords = toAdd.map((playerId) => ({
    session_id: sessionId,
    player_id: playerId,
    status: "waiting" as const,
  }));

  const { error: queueError } = await supabase.from("queue_entries").insert(queueRecords);

  if (queueError) {
    return { error: queueError.message };
  }

  recordSessionEvent({
    sessionId,
    type: "players_added",
    actorId: user!.id,
    actorRole: "admin",
    subjectIds: toAdd,
    details: { count: toAdd.length },
  });

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true, count: toAdd.length };
}

export async function leaveQueue(sessionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required." };
  }

  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("session_id", sessionId)
    .eq("player_id", user.id)
    .not("status", "in", "(playing,left)"); // waiting, called or on_break

  if (error) {
    return { error: error.message };
  }

  recordSessionEvent({
    sessionId,
    type: "left_queue",
    actorId: user.id,
    actorRole: "self",
    subjectIds: [user.id],
  });

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
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

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/");
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

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
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

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
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

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true };
}

export async function callNextUp(
  sessionId: string,
  courtId: string,
  // Kept for existing callers; every style plays doubles, so the decision always picks four.
  _count: number = 4,
  options: { force?: boolean } = {}
) {
  const supabase = await createClient();

  // 0. Guard: Verify court is available and not currently in-play with an active match
  const { data: court } = await supabase
    .from("courts")
    .select("id, name, status, current_match_id")
    .eq("id", courtId)
    .single();

  if (court && court.status === "occupied" && court.current_match_id) {
    return {
      error: `${court.name || "This court"} is currently IN PLAY with an active match. Please finalize the score first before calling next up.`,
    };
  }

  // 1. Determine matching style from session configuration
  const { data: sessionData } = await supabase
    .from("sessions")
    .select("description, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionData && sessionData.status !== "active") {
    return { error: "Start the session before calling players onto courts." };
  }

  const { matchingMode: matchingStyle, skillSpread } = parseSessionMetadata(sessionData?.description);

  // 2. This session's completed games and the ladder of open courts
  const [history, courts] = await Promise.all([
    loadSessionHistory(supabase, sessionId),
    loadOpenCourtIds(supabase),
  ]);

  // 3. Fetch waiting entries with player ratings and pair info
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
    .order("joined_at", { ascending: true })
    .limit(CALL_WINDOW_LIMIT);

  if (qErr || !allWaitingEntries || allWaitingEntries.length === 0) {
    return { error: "No waiting players currently in queue." };
  }

  // 4. Decide who plays and how they split
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
    return { error: holdMessage(decision, skillSpread), hold: decision.hold };
  }
  const teamA = decision.teamA;
  const teamB = decision.teamB;
  const playing = new Set<string>([...teamA, ...teamB]);
  const entryIds = allWaitingEntries.filter((e) => playing.has(e.player_id)).map((e) => e.id);

  // 5. Mark selected queue entries as playing
  await supabase
    .from("queue_entries")
    .update({
      status: "playing",
      called_at: new Date().toISOString(),
      target_court_id: courtId,
    })
    .in("id", entryIds);

  // 6. Create Match and assign to court
  // Void any previous orphaned in_progress matches on this court
  await supabase
    .from("matches")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("court_id", courtId)
    .eq("status", "in_progress");

  const totalPlayersCount = teamA.length + teamB.length;
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      session_id: sessionId,
      court_id: courtId,
      format: totalPlayersCount >= 4 ? "doubles" : "singles",
      status: "in_progress",
      team_a_score: 0,
      team_b_score: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (matchError || !match) {
    console.error("Match creation error:", matchError);
    return { error: matchError?.message || "Failed to create match." };
  }

  // Link court to match
  await supabase
    .from("courts")
    .update({
      status: "occupied",
      current_match_id: match.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courtId);

  // Insert match players
  const matchPlayersToInsert = [
    ...teamA.map((id) => ({
      match_id: match.id,
      player_id: id,
      team: "team_a" as const,
    })),
    ...teamB.map((id) => ({
      match_id: match.id,
      player_id: id,
      team: "team_b" as const,
    })),
  ];

  await supabase.from("match_players").insert(matchPlayersToInsert);

  // Logged as the signed-in admin who called the group (or whose saved result auto-filled the court).
  recordSessionEvent(async () => {
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) return null;
    return {
      sessionId,
      type: "game_started",
      actorId: caller.id,
      actorRole: "admin",
      subjectIds: [...teamA, ...teamB],
      courtId,
      matchId: match.id,
      details: { courtName: court?.name ?? null, teamA, teamB },
    };
  });

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/courts/${courtId}/monitor`);
  revalidatePath("/");
  return { success: true, count: entryIds.length, matchId: match.id };
}

/**
 * Calls the next group from the queue onto every open court, one court at a time,
 * until courts or waiting players run out.
 */
export async function fillOpenCourts(sessionId: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const { data: openCourts } = await supabase
    .from("courts")
    .select("id")
    .eq("status", "available")
    .is("current_match_id", null)
    .order("sort_order", { ascending: true });

  if (!openCourts || openCourts.length === 0) {
    return { error: "No open courts right now." };
  }

  let filled = 0;
  let lastError: string | undefined;
  for (const court of openCourts) {
    const res = await callNextUp(sessionId, court.id, 4);
    if (res?.error) {
      lastError = res.error;
      break;
    }
    filled++;
  }

  if (filled === 0) return { error: lastError || "No courts could be filled." };
  return { success: true, filled, remainingOpen: openCourts.length - filled };
}

/**
 * Puts a player on a break (skipped by "Call next" but keeps their place) or brings
 * them back. Players change their own entry; admins can change anyone's.
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

  const { data: entry } = await supabase
    .from("queue_entries")
    .select("id, status")
    .eq("session_id", sessionId)
    .eq("player_id", targetPlayerId)
    .not("status", "in", "(playing,left)")
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!entry) {
    return { error: "You're not in the queue. Check in to join it." };
  }

  // joined_at is untouched, so coming back keeps the same place in line.
  const { error } = await supabase
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

  recordSessionEvent({
    sessionId,
    type: onBreak ? "break_started" : "break_ended",
    actorId: user.id,
    actorRole: targetPlayerId === user.id ? "self" : "admin",
    subjectIds: [targetPlayerId],
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true };
}

/**
 * Swaps a called player who didn't turn up for the next person in line, before the
 * first point. The no-show goes on a break at the back of the line.
 */
export async function swapNoShow(matchId: string, noShowPlayerId: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("id, session_id, court_id, status, team_a_score, team_b_score, started_at")
    .eq("id", matchId)
    .single();

  if (!match || match.status !== "in_progress") return { error: "This game is no longer in progress." };
  if (!canSwapNoShow(Number(match.team_a_score ?? 0), Number(match.team_b_score ?? 0), match.started_at)) {
    return { error: `Players can only be swapped before the first point, in the first ${NO_SHOW_WINDOW_MINUTES} minutes.` };
  }

  const { data: matchPlayers } = await supabase
    .from("match_players")
    .select("id, player_id")
    .eq("match_id", matchId);
  const slot = (matchPlayers || []).find((mp) => mp.player_id === noShowPlayerId);
  if (!slot) return { error: "That player isn't in this game." };

  const { data: waiting } = await supabase
    .from("queue_entries")
    .select("id, player_id, joined_at, player:profiles (email, full_name, display_name)")
    .eq("session_id", match.session_id)
    .eq("status", "waiting")
    .order("joined_at", { ascending: true })
    .limit(20);

  const candidates = (waiting || []).filter(
    (w) => !isRootSystemAdmin((w.player as { email?: string | null } | null)?.email)
  );
  // Claim the replacement only if they're still waiting, so another court or admin
  // calling them at the same moment can't put them in two games.
  const now = new Date().toISOString();
  const inMatch = (matchPlayers || []).map((mp) => mp.player_id);
  const ordered: { id: string; player_id: string }[] = [];
  let remaining = candidates;
  for (let next = pickReplacement(remaining, inMatch); next; next = pickReplacement(remaining, inMatch)) {
    ordered.push(next);
    remaining = remaining.filter((c) => c.id !== next!.id);
  }
  const replacement = await claimFirstAvailable(ordered, async (c) => {
    const { data } = await supabase
      .from("queue_entries")
      .update({ status: "playing", called_at: now, target_court_id: match.court_id })
      .eq("id", c.id)
      .eq("status", "waiting")
      .select("id");
    return Boolean(data && data.length > 0);
  });
  if (!replacement) return { error: "No one is waiting to swap in." };

  // Only swap if the no-show is still in that slot (another admin may have swapped first).
  const { data: swapped, error: swapError } = await supabase
    .from("match_players")
    .update({ player_id: replacement.player_id })
    .eq("id", slot.id)
    .eq("player_id", noShowPlayerId)
    .select("id");
  if (swapError || !swapped || swapped.length === 0) {
    await supabase
      .from("queue_entries")
      .update({ status: "waiting", called_at: null, target_court_id: null })
      .eq("id", replacement.id);
    return { error: swapError?.message || "Someone already changed this game. Reload and try again." };
  }

  // The no-show keeps a spot but is skipped until they tap "I'm back".
  await supabase
    .from("queue_entries")
    .update({ status: "on_break", joined_at: now, target_court_id: null })
    .eq("session_id", match.session_id)
    .eq("player_id", noShowPlayerId)
    .eq("status", "playing");

  const actorId = auth.context!.userId;
  recordSessionEvent(async () => {
    const { data: swapCourt } = await supabase.from("courts").select("name").eq("id", match.court_id).maybeSingle();
    return {
      sessionId: match.session_id,
      type: "no_show_swapped",
      actorId,
      actorRole: "admin",
      subjectIds: [noShowPlayerId, replacement.player_id],
      courtId: match.court_id,
      matchId,
      details: { courtName: swapCourt?.name ?? null, out: noShowPlayerId, in: replacement.player_id },
    };
  });

  revalidatePath(`/sessions/${match.session_id}`);
  revalidatePath(`/courts/${match.court_id}/monitor`);
  revalidatePath("/");

  const replacementProfile = candidates.find((c) => c.id === replacement.id)?.player as
    | { full_name?: string | null; display_name?: string | null }
    | null;
  return {
    success: true as const,
    replacementName: replacementProfile?.full_name || replacementProfile?.display_name || "The next player",
  };
}
