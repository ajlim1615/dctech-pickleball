"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRootSystemAdmin, requireAdminUser } from "@/lib/security/authGuard";
import { canRsvp } from "@/features/sessions/utils/rsvp";
import { parseSessionMetadata } from "@/lib/utils";
import { isGuestProfile } from "@/features/admin/utils/playerDirectory";

function revalidateRsvpPaths(sessionId: string) {
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/admin");
  revalidatePath("/");
}

/** Say you're going to an upcoming session, or take it back. */
export async function setRsvp(sessionId: string, going: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to RSVP." };
  if (isRootSystemAdmin(user.email)) return { error: "The system admin account doesn't play." };

  const { data: session } = await supabase.from("sessions").select("status").eq("id", sessionId).maybeSingle();
  if (!session) return { error: "Session not found." };
  if (!canRsvp(session.status)) return { error: "RSVPs close when the session starts." };

  const { error } = going
    ? await supabase
        .from("session_rsvps")
        .upsert({ session_id: sessionId, player_id: user.id }, { onConflict: "session_id,player_id" })
    : await supabase.from("session_rsvps").delete().eq("session_id", sessionId).eq("player_id", user.id);
  if (error) return { error: error.message };

  revalidateRsvpPaths(sessionId);
  return { success: true as const };
}

/** Admin-only: remove a player from an upcoming session's Who's Going list. */
export async function removeRsvp(sessionId: string, playerId: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const { data: session } = await supabase.from("sessions").select("status").eq("id", sessionId).maybeSingle();
  if (!session) return { error: "Session not found." };
  if (!canRsvp(session.status)) return { error: "RSVPs close when the session starts." };

  const { error } = await supabase
    .from("session_rsvps")
    .delete()
    .eq("session_id", sessionId)
    .eq("player_id", playerId);
  if (error) return { error: error.message };

  revalidateRsvpPaths(sessionId);
  return { success: true as const };
}

/** Admin-only: add one or more players to an upcoming session's Who's Going list. */
export async function addRsvps(sessionId: string, playerIds: string[]) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const uniqueIds = Array.from(new Set(playerIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { error: "Select at least one player." };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("status, description")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "Session not found." };
  if (!canRsvp(session.status)) return { error: "RSVPs close when the session starts." };

  const adminClient = createAdminClient();
  if (parseSessionMetadata(session.description).isRanked) {
    const { data: targetProfiles } = await adminClient
      .from("profiles")
      .select("id, email, is_guest")
      .in("id", uniqueIds);
    if (targetProfiles?.some((p) => isGuestProfile(p))) {
      return { error: "Guest / non-employee players can only be added to Casual sessions." };
    }
  }

  // INSERT RLS only permits auth.uid() = player_id, so admin adds use the service client after requireAdminUser().
  const { error } = await adminClient
    .from("session_rsvps")
    .upsert(
      uniqueIds.map((player_id) => ({ session_id: sessionId, player_id })),
      { onConflict: "session_id,player_id" }
    );
  if (error) return { error: error.message };

  revalidateRsvpPaths(sessionId);
  return { success: true as const };
}

/** How many people are going, per session. Missing table (migration not applied) reads as zero. */
export async function getRsvpCounts(sessionIds: string[]): Promise<Record<string, number>> {
  if (sessionIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_rsvps").select("session_id").in("session_id", sessionIds);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data) counts[row.session_id] = (counts[row.session_id] || 0) + 1;
  return counts;
}

/** Which of these sessions the signed-in player has said they're going to. */
export async function getMyRsvpSessionIds(sessionIds: string[]): Promise<string[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("session_rsvps")
    .select("session_id")
    .eq("player_id", user.id)
    .in("session_id", sessionIds);
  if (error || !data) return [];
  return data.map((row) => row.session_id);
}

/** Names of everyone going to one session, earliest first. */
export async function getSessionRsvps(
  sessionId: string
): Promise<{ playerId: string; name: string; avatarUrl: string | null }[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("session_rsvps")
    .select("player_id, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error || !rows || rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_url")
    .in("id", rows.map((r) => r.player_id));
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.player_id);
    return {
      playerId: r.player_id,
      name: p?.full_name || p?.display_name || "Player",
      avatarUrl: p?.avatar_url || null,
    };
  });
}
