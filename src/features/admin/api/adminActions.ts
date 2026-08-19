"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, CourtStatus, Profile } from "@/types";

export async function updatePlayerRole(userId: string, role: UserRole) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/profile");
  return { success: true };
}

export async function adjustPlayerRating(userId: string, newRating: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ skill_rating: newRating, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/rankings");
  return { success: true };
}

export async function toggleCourtStatus(courtId: string, status: CourtStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", courtId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function resetSessionQueue(sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("session_id", sessionId)
    .in("status", ["waiting", "called"]);

  if (error) return { error: error.message };

  revalidatePath("/queue");
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function assignStaffToCourt(courtId: string, staffId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("courts")
    .update({ assigned_staff_id: staffId })
    .eq("id", courtId);

  if (error) {
    console.error("assignStaffToCourt error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/courts/${courtId}/monitor`);
  return { success: true };
}

export async function setRentedCourtCount(count: number, surfaceType?: string) {
  const supabase = await createClient();

  const { data: existingCourts } = await supabase
    .from("courts")
    .select("id")
    .order("sort_order", { ascending: true });

  const currentCount = existingCourts?.length || 0;

  if (count < currentCount) {
    const toRemove = existingCourts?.slice(count).map((c) => c.id) || [];
    if (toRemove.length > 0) {
      await supabase.from("courts").delete().in("id", toRemove);
    }
  } else if (count > currentCount) {
    const toAdd = [];
    for (let i = currentCount + 1; i <= count; i++) {
      toAdd.push({
        name: `Court ${i}`,
        surface_type: surfaceType || "Standard Court",
        status: "available" as CourtStatus,
        sort_order: i,
      });
    }
    const { error: insertError } = await supabase.from("courts").insert(toAdd);
    if (insertError) {
      console.error("setRentedCourtCount insert error:", insertError.message);
      return { error: insertError.message };
    }
  }

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true };
}

export async function createWalkInPlayer(params: {
  fullName: string;
  isGuest?: boolean;
  skillRating?: number;
}) {
  const supabase = await createClient();
  const rawEmail = `${params.isGuest ? "guest" : "unreg"}_${Date.now()}_${Math.floor(Math.random() * 1000)}@dctechmicro.local`;
  const newId = crypto.randomUUID();

  const formattedName = params.isGuest
    ? params.fullName.includes("(Guest)") ? params.fullName : `${params.fullName} (Guest)`
    : params.fullName;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: newId,
      email: rawEmail,
      full_name: formattedName,
      display_name: params.fullName,
      role: "player",
      skill_rating: params.skillRating || 3.0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("createWalkInPlayer error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/queue");
  revalidatePath("/matches/new");
  return { success: true, player: data };
}

export async function getAllEmployees(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });

  if (error || !data) return [];
  return data as Profile[];
}
