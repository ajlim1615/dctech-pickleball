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
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (sessionError || !session) return null;

  const { data: checkins } = await supabase
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
        skill_rating
      )
    `)
    .eq("session_id", id)
    .eq("status", "checked_in");

  return {
    ...session,
    checkins: checkins || [],
  };
}

export async function createSession(formData: FormData) {
  const supabase = await createClient();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const location = (formData.get("location") as string) || "DCTECH Sports Arena";
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const maxPlayersStr = formData.get("maxPlayers") as string;
  const courtCountStr = formData.get("courtCount") as string;
  const courtCount = courtCountStr ? parseInt(courtCountStr, 10) : 4;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Authentication required." };
  }

  const { error } = await supabase.from("sessions").insert({
    title,
    description: description || null,
    location,
    start_time: new Date(startTime).toISOString(),
    end_time: new Date(endTime).toISOString(),
    max_players: maxPlayersStr ? parseInt(maxPlayersStr, 10) : null,
    created_by: user.id,
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
        console.error("Failed to provision additional courts:", courtInsertError.message);
      }
    }
  }

  revalidatePath("/sessions");
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // If activating a session, ensure baseline courts exist in database
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
