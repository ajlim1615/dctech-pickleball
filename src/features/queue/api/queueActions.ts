"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntry, QueueEntryWithPlayer, QueueStatus, Profile } from "@/types";
import { createMatchupFromPod, type MatchingStyle } from "@/features/queue/utils/matchingEngine";

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
    .in("status", ["waiting", "called"])
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
    .in("status", ["waiting", "called"])
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
      .in("status", ["waiting", "called"])
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
    .in("status", ["waiting", "called", "playing"]);

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
    .in("status", ["waiting", "called"]);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true };
}

export async function adminRemovePlayerFromQueue(sessionId: string, queueEntryId: string) {
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

  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("id", queueEntryId)
    .eq("session_id", sessionId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
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
    .select("id, joined_at")
    .in("id", [entryId1, entryId2]);

  if (error || !entries || entries.length !== 2) {
    return { error: "Could not find both player entries to swap." };
  }

  const time1 = entries[0].joined_at;
  const time2 = entries[1].joined_at;

  await supabase.from("queue_entries").update({ joined_at: time2 }).eq("id", entries[0].id);
  await supabase.from("queue_entries").update({ joined_at: time1 }).eq("id", entries[1].id);

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

  const { error } = await supabase
    .from("queue_entries")
    .update({ player_id: newPlayerId })
    .eq("id", queueEntryId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true };
}

export async function callNextUp(sessionId: string, courtId: string, count: number = 4) {
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
    .select("description")
    .eq("id", sessionId)
    .maybeSingle();

  const modeMatch = sessionData?.description?.match(/\[matching_mode:([a-z_]+)\]/i);
  const matchingStyle = (modeMatch ? modeMatch[1] : "balanced") as MatchingStyle;

  // 2. Query previous completed match on this court to find previous winners (for king_queen, winners_stay, winners_losers)
  let previousWinners: Profile[] = [];
  const { data: lastMatch } = await (supabase as any)
    .from("matches")
    .select(`
      id,
      winning_team,
      players:match_players (
        player_id,
        team,
        player:profiles (
          id,
          full_name,
          display_name,
          avatar_url,
          skill_rating,
          email,
          role,
          games_played,
          games_won,
          is_active,
          created_at,
          updated_at
        )
      )
    `)
    .eq("court_id", courtId)
    .eq("status", "completed")
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMatch && lastMatch.winning_team) {
    const playersList = ((lastMatch as any).players || []) as any[];
    previousWinners = playersList
      .filter((p: any) => p.team === lastMatch.winning_team && p.player)
      .map((p: any) => p.player as Profile);
  }

  // In King of the Court / Winners Stay, if 2 winners stay on court, only call 2 new challengers
  const isWinnersStay =
    (matchingStyle === "winners_stay" || matchingStyle === "king_queen") &&
    previousWinners.length === 2;
  const targetCount = isWinnersStay ? 2 : count;

  // 3. Fetch waiting entries with player profiles and group info
  const { data: waitingEntries, error: qErr } = await supabase
    .from("queue_entries")
    .select(`
      id,
      player_id,
      group_id,
      joined_at,
      player:profiles (
        id,
        full_name,
        display_name,
        avatar_url,
        skill_rating,
        email,
        role,
        games_played,
        games_won,
        is_active,
        created_at,
        updated_at
      )
    `)
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .order("joined_at", { ascending: true })
    .limit(16);

  if (qErr || !waitingEntries || waitingEntries.length === 0) {
    return { error: "No waiting players currently in queue." };
  }

  // 4. Select pod with Pair-Protection & Skill-Separation
  let selectedEntries: typeof waitingEntries = [];

  if (waitingEntries.length <= targetCount) {
    selectedEntries = [...waitingEntries];
  } else if (
    (matchingStyle === "skill_separated" || matchingStyle === "skill_courts") &&
    waitingEntries.length >= 6
  ) {
    // Skill-separated: Anchor to the first in line (FIFO), then find the players closest in skill
    const anchor = waitingEntries[0];
    const anchorRating = Number((anchor.player as any)?.skill_rating || 3.0);
    const rest = waitingEntries.slice(1);
    rest.sort((a, b) => {
      const diffA = Math.abs(Number((a.player as any)?.skill_rating || 3.0) - anchorRating);
      const diffB = Math.abs(Number((b.player as any)?.skill_rating || 3.0) - anchorRating);
      return diffA - diffB;
    });
    selectedEntries = [anchor, ...rest.slice(0, targetCount - 1)];
  } else {
    // FIFO with Bonded-Pair Protection (Never split doubles partners across rack boundary)
    const candidates = waitingEntries.slice(0, targetCount);
    if (targetCount === 4 && waitingEntries.length > 4) {
      // Check if the 4th player is the first half of a bonded pair whose partner is at index 4 (5th in line)
      const p4 = candidates[3];
      if (p4.group_id) {
        const partnerIndex = waitingEntries.findIndex(
          (w, idx) => idx >= 4 && w.group_id === p4.group_id
        );
        if (partnerIndex !== -1) {
          // Find an unbonded solo player in candidates to defer so the pair stays together
          const soloIdx = candidates.findIndex((c) => !c.group_id);
          if (soloIdx !== -1) {
            // Replace the solo player with the partner
            candidates[soloIdx] = waitingEntries[partnerIndex];
          }
        }
      }
    }
    selectedEntries = candidates;
  }

  const entryIds = selectedEntries.map((e) => e.id);
  const challengerProfiles: Profile[] = selectedEntries.map(
    (e) => ((e.player || e) as unknown) as Profile
  );

  // 5. Mark selected queue entries as playing
  await supabase
    .from("queue_entries")
    .update({
      status: "playing",
      called_at: new Date().toISOString(),
      target_court_id: courtId,
    })
    .in("id", entryIds);

  let teamA: string[] = [];
  let teamB: string[] = [];

  if (isWinnersStay && previousWinners.length === 2 && challengerProfiles.length >= 2) {
    // Winners Stay: Split the 2 previous winners, each partnered with 1 challenger
    const fullPod = [...previousWinners, ...challengerProfiles];
    const matchup = createMatchupFromPod(fullPod, matchingStyle, previousWinners);
    teamA = matchup.teamA.map((p) => p.id);
    teamB = matchup.teamB.map((p) => p.id);
  } else if (challengerProfiles.length >= 4) {
    // Check if there is a locked paired group (Coworker doubles pair)
    const groups: { [gid: string]: string[] } = {};
    selectedEntries.forEach((p) => {
      if (p.group_id) {
        groups[p.group_id] = groups[p.group_id] || [];
        groups[p.group_id].push(p.player_id);
      }
    });

    const pairedGroup = Object.values(groups).find((g) => g.length === 2);

    if (pairedGroup) {
      teamA = pairedGroup;
      teamB = selectedEntries
        .filter((p) => !teamA.includes(p.player_id))
        .map((p) => p.player_id)
        .slice(0, 2);
    } else {
      // Execute the algorithm for the assigned MatchingStyle
      const matchup = createMatchupFromPod(challengerProfiles, matchingStyle, previousWinners);
      teamA = matchup.teamA.map((p) => p.id);
      teamB = matchup.teamB.map((p) => p.id);
    }
  } else if (challengerProfiles.length === 2) {
    teamA = [challengerProfiles[0].id];
    teamB = [challengerProfiles[1].id];
  } else {
    teamA = [challengerProfiles[0]?.id].filter(Boolean);
    teamB = challengerProfiles.slice(1).map((p) => p.id);
  }

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

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/courts/${courtId}/monitor`);
  revalidatePath("/");
  return { success: true, count: entryIds.length, matchId: match.id };
}
