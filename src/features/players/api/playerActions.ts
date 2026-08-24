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

  // Server-Side Guard: Max 250KB storage cap per avatar
  const MAX_AVATAR_STORAGE_BYTES = 250 * 1024;
  if (avatarUrl && avatarUrl !== "__REMOVE__" && avatarUrl.length > MAX_AVATAR_STORAGE_BYTES) {
    return { error: "Avatar image data exceeds the maximum allowed storage limit (250KB)." };
  }

  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (displayName) updates.display_name = displayName;
  if (fullName) updates.full_name = fullName;
  if (formData.has("avatarUrl")) {
    updates.avatar_url = avatarUrl === "__REMOVE__" || !avatarUrl ? null : avatarUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/rankings");
  revalidatePath("/");
  return { success: true };
}

export async function getPlayerMatchHistory(userId: string) {
  const supabase = await createClient();

  // 1. Fetch match_players entries for this user
  const { data: playerEntries, error: mpError } = await supabase
    .from("match_players")
    .select("id, match_id, team, created_at")
    .eq("player_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (mpError || !playerEntries || playerEntries.length === 0) {
    if (mpError) console.error("Error fetching match_players:", mpError.message);
    return [];
  }

  // Deduplicate by match_id so each match is only represented once
  const seenMatchIds = new Set<string>();
  const uniquePlayerEntries = playerEntries.filter((pe) => {
    if (!pe.match_id || seenMatchIds.has(pe.match_id)) return false;
    seenMatchIds.add(pe.match_id);
    return true;
  });

  const matchIds = Array.from(seenMatchIds);
  if (matchIds.length === 0) return [];

  // 2. Fetch matches, courts, all match_players, and sessions in parallel
  const [matchesRes, courtsRes, allMatchPlayersRes, sessionsRes] = await Promise.all([
    supabase
      .from("matches")
      .select("id, session_id, court_id, format, status, team_a_score, team_b_score, winning_team, started_at, ended_at, is_verified, created_at")
      .in("id", matchIds),
    supabase
      .from("courts")
      .select("id, name"),
    supabase
      .from("match_players")
      .select("match_id, player_id, team")
      .in("match_id", matchIds),
    supabase
      .from("sessions")
      .select("id, title, status"),
  ]);

  if (matchesRes.error) {
    console.error("Error fetching matches for player:", matchesRes.error.message);
    return [];
  }

  // 3. Fetch player profiles for all participants in these matches
  const allPlayerIds = Array.from(
    new Set((allMatchPlayersRes.data || []).map((mp) => mp.player_id).filter(Boolean))
  );

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_url")
    .in("id", allPlayerIds);

  const profileMap = new Map((profilesData || []).map((p) => [p.id, p]));
  const courtMap = new Map((courtsRes.data || []).map((c) => [c.id, c.name]));
  const sessionMap = new Map((sessionsRes.data || []).map((s) => [s.id, s]));
  const matchMap = new Map((matchesRes.data || []).map((m) => [m.id, m]));

  // Group participants by match_id
  const matchPlayersByMatchId = new Map<
    string,
    Array<{ player_id: string; team: string; name: string; avatar_url?: string | null }>
  >();

  for (const mp of allMatchPlayersRes.data || []) {
    const list = matchPlayersByMatchId.get(mp.match_id) || [];
    const prof = profileMap.get(mp.player_id);
    list.push({
      player_id: mp.player_id,
      team: mp.team,
      name: prof?.full_name || prof?.display_name || "Player",
      avatar_url: prof?.avatar_url,
    });
    matchPlayersByMatchId.set(mp.match_id, list);
  }

  const rawResults = uniquePlayerEntries
    .map((pe) => {
      const match = matchMap.get(pe.match_id);
      if (!match || match.status === "abandoned") return null;

      const courtName = match.court_id ? courtMap.get(match.court_id) || `Court` : "Court";
      const sessionObj = match.session_id ? sessionMap.get(match.session_id) : null;
      const sessionTitle = sessionObj?.title || "Open Play Session";
      const sessionStatus = sessionObj?.status || "active";

      const allParticipants = matchPlayersByMatchId.get(pe.match_id) || [];
      const myTeam = pe.team;

      const partners = allParticipants.filter(
        (p) => p.team === myTeam && p.player_id !== userId
      );
      const opponents = allParticipants.filter((p) => p.team !== myTeam);

      const partnerName = partners.length > 0 ? partners.map((p) => p.name).join(", ") : undefined;
      const opponentsName = opponents.length > 0 ? opponents.map((p) => p.name).join(" & ") : "Opponent(s)";

      return {
        id: pe.id,
        team: pe.team,
        created_at: pe.created_at || match.created_at,
        sessionTitle,
        sessionStatus,
        partner: partnerName,
        opponents: opponentsName,
        match: {
          ...match,
          court: { name: courtName },
        },
      };
    })
    .filter(Boolean) as any[];

  // A player can only have at most 1 active LIVE match. Filter out stale orphaned live matches.
  let hasLiveMatch = false;
  const results: any[] = [];
  for (const item of rawResults) {
    if (item.match?.status === "in_progress") {
      if (hasLiveMatch) continue;
      hasLiveMatch = true;
    }
    results.push(item);
  }

  return results.slice(0, 15);
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
