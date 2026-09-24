"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, CourtStatus, Profile } from "@/types";

import { requireAdminUser } from "@/lib/security/authGuard";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rateLimit";
import { WalkInPlayerSchema, UpdatePlayerDetailsSchema, sanitizeString } from "@/lib/security/validation";

export async function updatePlayerDetails(userId: string, fullName: string, email: string) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  // Rate Limiting
  const rateLimit = checkRateLimit(auth.context?.userId || "admin", "admin_player_update", RATE_LIMIT_CONFIGS.ADMIN_ACTIONS);
  if (!rateLimit.success) return { error: rateLimit.error };

  const validation = UpdatePlayerDetailsSchema.safeParse({ userId, fullName, email });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid player details." };
  }

  const { fullName: cleanName, email: cleanEmail } = validation.data;
  const supabase = await createClient();

  // Guard: Protect root system admin
  const { data: targetProfile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  if (targetProfile?.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account (admin@dctechmicro.com) is locked and cannot be edited." };
  }

  // Check if the new email is already taken by another player
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", cleanEmail)
    .neq("id", userId)
    .maybeSingle();

  if (existingUser) {
    return {
      error: `Email "${cleanEmail}" is already registered to another player (${existingUser.full_name || "Profile"}).`,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: cleanName,
      display_name: cleanName,
      email: cleanEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("updatePlayerDetails error:", error.message);
    return { error: error.message };
  }

  // Ensure an auth user exists with default password 'dctech123' if official corporate email
  if (cleanEmail.endsWith("@dctechmicro.com")) {
    try {
      const adminClient = createAdminClient();
      await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password: "dctech123",
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
        },
      });
    } catch (authErr) {
      console.warn("Auth user ensure note:", authErr);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/queue");
  revalidatePath("/sessions");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true };
}

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
    .select("id, name, status, current_match_id, sort_order")
    .order("sort_order", { ascending: true });

  const currentCount = existingCourts?.length || 0;

  if (count < currentCount) {
    const courtsCandidateForRemoval = existingCourts?.slice(count) || [];
    // Safety Guard: Check if any court targeted for removal is occupied or has an active match
    const busyCourt = courtsCandidateForRemoval.find(
      (c) => c.status === "occupied" || c.current_match_id !== null
    );

    if (busyCourt) {
      return {
        error: `Cannot reduce to ${count} courts: ${busyCourt.name} currently has a match in progress. Conclude the match first.`,
      };
    }

    const toRemove = courtsCandidateForRemoval.map((c) => c.id);
    if (toRemove.length > 0) {
      const { error: delError } = await supabase.from("courts").delete().in("id", toRemove);
      if (delError) {
        return { error: delError.message };
      }
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

  // Fetch and return the newly updated list of courts with true database UUIDs
  const { data: updatedCourts } = await supabase
    .from("courts")
    .select("id, name, status, surface_type, assigned_staff_id, sort_order")
    .order("sort_order", { ascending: true });

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true, courts: updatedCourts || [] };
}

export async function togglePlayerActiveStatus(userId: string, isActive: boolean) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  // Root Admin cannot be deactivated
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  if (profile?.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account cannot be deactivated." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/rankings");
  revalidatePath("/queue");
  revalidatePath("/profile");
  return { success: true };
}

export async function cancelSession(sessionId: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  const { error } = await supabase
    .from("sessions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  // Clear waiting/called queue entries
  await supabase
    .from("queue_entries")
    .update({ status: "left" })
    .eq("session_id", sessionId)
    .in("status", ["waiting", "called"]);

  // Free courts if this was the active session
  await supabase
    .from("courts")
    .update({ status: "available", current_match_id: null, updated_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  revalidatePath("/queue");
  return { success: true };
}

export async function editSession(sessionId: string, formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const rawTitle = formData.get("title") as string;
  const rawDescription = formData.get("description") as string;
  const rawLocation = (formData.get("location") as string) || "DCTECH Sports Arena";
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const maxPlayersStr = formData.get("maxPlayers") as string;
  const matchingStyle = sanitizeString((formData.get("matchingStyle") as string) || "balanced");
  const isRanked = formData.get("isRanked") !== "false";
  const targetPointsStr = (formData.get("targetPoints") as string) || "11";
  const targetPoints = parseInt(targetPointsStr, 10) === 6 ? 6 : 11;

  if (!rawTitle || !startTime || !endTime) {
    return { error: "Session title, start time, and end time are required." };
  }

  const title = sanitizeString(rawTitle);
  const location = sanitizeString(rawLocation);
  const userDesc = sanitizeString(rawDescription || "");

  // Metadata tags
  const tags = `[matching_mode:${matchingStyle}] [ranked:${isRanked}] [target_points:${targetPoints}]`;
  const finalDescription = userDesc ? `${userDesc} ${tags}` : tags;

  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      title,
      description: finalDescription,
      location,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      max_players: maxPlayersStr ? Math.min(200, Math.max(2, parseInt(maxPlayersStr, 10))) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true };
}

export async function createWalkInPlayer(params: {
  fullName: string;
  email?: string;
  isGuest?: boolean;
  skillRating?: number;
}) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const validation = WalkInPlayerSchema.safeParse({
    name: params.fullName,
    email: params.email,
    type: params.isGuest ? "guest" : "employee",
    skillRating: params.skillRating || 3.0,
  });

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid player details." };
  }

  const cleanName = validation.data.name;
  const providedEmail = validation.data.email;
  const supabase = await createClient();

  // If email is provided, check if profile already exists with this email
  if (providedEmail) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", providedEmail)
      .maybeSingle();

    if (existingProfile) {
      return {
        error: `A player with email "${providedEmail}" is already registered (${existingProfile.full_name || "Profile"}).`,
      };
    }
  }

  const rawEmail =
    providedEmail ||
    `${params.isGuest ? "guest" : "unreg"}_${Date.now()}_${Math.floor(Math.random() * 1000)}@dctechmicro.local`;
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

  // Provision Supabase Auth User with default password 'dctech123' if corporate email provided
  if (providedEmail && providedEmail.endsWith("@dctechmicro.com")) {
    try {
      const adminClient = createAdminClient();
      await adminClient.auth.admin.createUser({
        email: providedEmail,
        password: "dctech123",
        email_confirm: true,
        user_metadata: {
          full_name: formattedName,
        },
      });
    } catch (authErr) {
      console.warn("Auth user creation note:", authErr);
    }
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
