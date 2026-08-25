"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, CourtStatus, Profile } from "@/types";

import { requireAdminUser } from "@/lib/security/authGuard";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rateLimit";
import { WalkInPlayerSchema, sanitizeString } from "@/lib/security/validation";

export async function updatePlayerRole(userId: string, role: UserRole) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  // Rate Limiting
  const rateLimit = checkRateLimit(auth.context?.userId || "admin", "admin_role_update", RATE_LIMIT_CONFIGS.ADMIN_ACTIONS);
  if (!rateLimit.success) return { error: rateLimit.error };

  const supabase = await createClient();

  // Guard: Protect root system admin
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  if (profile?.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account (admin@dctechmicro.com) role is locked and cannot be changed." };
  }

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
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  // Rate Limiting
  const rateLimit = checkRateLimit(auth.context?.userId || "admin", "admin_rating_adjust", RATE_LIMIT_CONFIGS.ADMIN_ACTIONS);
  if (!rateLimit.success) return { error: rateLimit.error };

  const supabase = await createClient();

  // Guard: System admin does not have a player rating
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  if (profile?.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account (admin@dctechmicro.com) is a non-playing administrator and cannot have a rating." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ skill_rating: newRating, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  revalidatePath("/queue");
  revalidatePath("/");
  return { success: true };
}

export async function toggleCourtStatus(courtId: string, status: CourtStatus) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

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
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

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
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

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
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

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
        surface_type: surfaceType ? sanitizeString(surfaceType) : "Standard Court",
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
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const validation = WalkInPlayerSchema.safeParse({
    name: params.fullName,
    type: params.isGuest ? "guest" : "employee",
    skillRating: params.skillRating || 3.0,
  });

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid player details." };
  }

  const cleanName = validation.data.name;
  const supabase = await createClient();
  const rawEmail = `${params.isGuest ? "guest" : "unreg"}_${Date.now()}_${Math.floor(Math.random() * 1000)}@dctechmicro.local`;
  const newId = crypto.randomUUID();

  const formattedName = params.isGuest
    ? cleanName.includes("(Guest)") ? cleanName : `${cleanName} (Guest)`
    : cleanName;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: newId,
      email: rawEmail,
      full_name: formattedName,
      display_name: cleanName,
      role: "player",
      skill_rating: validation.data.skillRating,
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
  revalidatePath("/sessions");
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
