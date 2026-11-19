"use server";

import { cache } from "react";
import { GUEST_RANKED_MESSAGE, blockedFromSession } from "@/features/sessions/utils/guestRules";
import { revalidatePath } from "next/cache";
import { canRsvp } from "@/features/sessions/utils/rsvp";
import { createClient } from "@/lib/supabase/server";
import { LINE_STATUSES } from "@/features/queue/constants/queueStatuses";
import { closeSession } from "@/features/sessions/server/closeSession";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, CourtStatus, Profile } from "@/types";

import { isRootSystemAdmin, requireAdminUser, requireSystemAdmin } from "@/lib/security/authGuard";
import { DEFAULT_PASSWORD } from "@/lib/security/defaultPassword";
import { deleteAvatar } from "@/features/players/server/avatarStorage";
import { createPlayerAccount } from "@/features/players/server/createPlayer";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rateLimit";
import { WalkInPlayerSchema, UpdatePlayerDetailsSchema, AdjustRatingSchema, sanitizeString } from "@/lib/security/validation";
import { RATING_RULES } from "@/features/rankings/ratingConfig";
import { parsePHTToISO } from "@/lib/timezone";
import {
  extractCourtNamesTag,
  mergeSessionDescription,
  parseCourtCount,
  parseSessionMetadata,
  parseSkillSpread,
  setSessionCourtCount,
  setSessionCourtNames,
} from "@/lib/utils";
import { recordSessionEvent, resolveSessionCourtName } from "@/features/activity/server/logEvent";

export async function updatePlayerDetails(userId: string, fullName: string, email: string) {
  // Only the System Admin changes who a player is (name, email).
  const auth = await requireSystemAdmin();
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
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        // Shared default: the user must set their own password on first sign-in.
        app_metadata: { must_change_password: true },
        user_metadata: {
          full_name: cleanName,
        },
      });
    } catch (authErr) {
      console.warn("Auth user ensure note:", authErr);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true };
}

export async function updatePlayerRole(userId: string, role: UserRole) {
  // Only the System Admin makes someone an admin or takes it away.
  const auth = await requireSystemAdmin();
  if (auth.error) return { error: auth.error };
  if (role !== "player" && role !== "admin") return { error: "A player can only be made a Player or an Admin." };

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
  // Only the System Admin sets a rating by hand; games move it otherwise.
  const auth = await requireSystemAdmin();
  if (auth.error) return { error: auth.error };

  // Rate Limiting
  const rateLimit = checkRateLimit(auth.context?.userId || "admin", "admin_rating_adjust", RATE_LIMIT_CONFIGS.ADMIN_ACTIONS);
  if (!rateLimit.success) return { error: rateLimit.error };

  const validation = AdjustRatingSchema.safeParse({ userId, newRating });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid rating." };
  }

  const supabase = await createClient();

  // Guard: System admin does not have a player rating
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  if (profile?.email?.toLowerCase() === "admin@dctechmicro.com") {
    return { error: "The System Admin account (admin@dctechmicro.com) is a non-playing administrator and cannot have a rating." };
  }

  // Clamps to the rules' bounds, refuses the System Admin, and leaves a history row.
  const { data: result, error } = await supabase.rpc("admin_set_rating", {
    p_player_id: userId,
    p_new_rating: validation.data.newRating,
    p_rules_version: RATING_RULES.version,
    p_min_rating: RATING_RULES.min,
    p_max_rating: RATING_RULES.max,
  });

  if (error) return { error: error.message };
  const outcome = result as { error?: string } | null;
  if (outcome?.error) return { error: outcome.error };

  revalidatePath("/admin");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true };
}

export async function toggleCourtStatus(
  courtId: string,
  status: CourtStatus,
  sessionId?: string
) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("courts")
    .select("status")
    .eq("id", courtId)
    .maybeSingle();

  if (existing?.status === "occupied" && status !== "occupied") {
    return { error: "Finish or clear the active game before changing court status." };
  }

  const { error } = await supabase
    .from("courts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", courtId);

  if (error) return { error: error.message };

  if (status !== "occupied") {
    const actorId = auth.context!.userId;
    recordSessionEvent(async () => {
      const liveRes = sessionId
        ? { data: { id: sessionId } }
        : await supabase.from("sessions").select("id").eq("status", "active").maybeSingle();
      const targetSessionId = liveRes.data?.id ?? null;
      return {
        sessionId: targetSessionId,
        type: status === "available" ? "court_reopened" : "court_closed",
        actorId,
        actorRole: "admin",
        courtId,
        details: { courtName: await resolveSessionCourtName(supabase, targetSessionId, courtId), status },
      };
    });
  }

  revalidatePath("/admin");
  revalidatePath("/sessions");
  if (sessionId) revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateSessionCourtName(
  sessionId: string,
  courtSlot: number,
  name: string
) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const cleanName = sanitizeString(name);
  if (!cleanName) {
    return { error: "Court name is required." };
  }
  if (!Number.isInteger(courtSlot) || courtSlot < 1 || courtSlot > 12) {
    return { error: "Invalid court slot." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("sessions")
    .select("description")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Session not found." };

  const currentNames = parseSessionMetadata(existing.description).courtNames;
  const nextNames = { ...currentNames, [String(courtSlot)]: cleanName };
  const finalDescription = setSessionCourtNames(existing.description, nextNames);

  const { error } = await supabase
    .from("sessions")
    .update({ description: finalDescription, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true, name: cleanName };
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
    .in("status", LINE_STATUSES); // waiting, called or on_break

  if (error) return { error: error.message };

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

    // Past games on a removed court are kept; matches.court_id is set null
    // (migration 20261116010000_keep_matches_when_court_removed).
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

  // Keep the active session's [courts:N] metadata in sync with the live arena count.
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id, description")
    .eq("status", "active")
    .maybeSingle();

  if (activeSession) {
    const syncedDesc = setSessionCourtCount(activeSession.description, count);
    await supabase
      .from("sessions")
      .update({ description: syncedDesc, updated_at: new Date().toISOString() })
      .eq("id", activeSession.id);
    revalidatePath(`/sessions/${activeSession.id}`);
  }

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true, courts: updatedCourts || [] };
}

/**
 * Removes one court from a live session. Refused while a game is on it, and the
 * last court can't go. The courts after it move up a slot, and so do their names.
 */
export async function removeSessionCourt(sessionId: string, courtId: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  const supabase = await createClient();

  const [{ data: session }, { data: courts }, { count: liveGames }] = await Promise.all([
    supabase.from("sessions").select("status, description").eq("id", sessionId).maybeSingle(),
    supabase.from("courts").select("id, name, status, current_match_id, sort_order").order("sort_order", { ascending: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("court_id", courtId).eq("status", "in_progress"),
  ]);
  if (!session) return { error: "Session not found." };
  if (session.status !== "active") return { error: "Courts can only be removed while the session is live." };
  const all = courts ?? [];
  const index = all.findIndex((c) => c.id === courtId);
  if (index === -1) return { error: "That court is already gone." };
  const target = all[index];
  if (target.status === "occupied" || target.current_match_id || (liveGames ?? 0) > 0) {
    return { error: `${target.name} has a game in play. Finish it first.` };
  }
  if (all.length <= 1) return { error: "A session needs at least one court." };

  // Past games on a removed court are kept; matches.court_id is set null.
  const { error: delError } = await supabase.from("courts").delete().eq("id", courtId);
  if (delError) return { error: delError.message };

  // Close the gap: every court after it moves up one slot, keeping its session name.
  const oldNames = parseSessionMetadata(session.description).courtNames ?? {};
  const remaining = all.filter((c) => c.id !== courtId);
  const newNames: Record<string, string> = {};
  for (let i = 0; i < remaining.length; i++) {
    const oldSlot = String(all.indexOf(remaining[i]) + 1);
    const name = oldNames[String(remaining[i].sort_order ?? oldSlot)] ?? oldNames[oldSlot];
    if (name) newNames[String(i + 1)] = name;
  }
  const moves = remaining
    .map((c, i) => ({ id: c.id, from: c.sort_order, to: i + 1 }))
    .filter((m) => m.from !== m.to);
  for (const m of moves) {
    const { error } = await supabase.from("courts").update({ sort_order: m.to }).eq("id", m.id);
    if (error) console.error("removeSessionCourt reorder failed:", error.message);
  }

  let description = setSessionCourtCount(session.description, remaining.length);
  description = setSessionCourtNames(description, newNames);
  const { error } = await supabase
    .from("sessions")
    .update({ description, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true, courtCount: remaining.length };
}

/** `newCourtName` names the court being added (it takes the last slot). */
export async function updateSessionCourtCount(sessionId: string, count: number, newCourtName?: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const clamped = Math.min(12, Math.max(1, Math.round(count)));
  const cleanCourtName = newCourtName === undefined ? null : sanitizeString(newCourtName);
  if (newCourtName !== undefined && !cleanCourtName) return { error: "Court name is required." };
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("sessions")
    .select("status, description")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Session not found." };

  if (existing.status === "active") {
    const courtRes = await setRentedCourtCount(clamped, "Standard Court");
    if (courtRes?.error) {
      return { error: courtRes.error };
    }
  }

  let nextDescription = setSessionCourtCount(existing.description, clamped);
  if (cleanCourtName) {
    const names = parseSessionMetadata(nextDescription).courtNames;
    nextDescription = setSessionCourtNames(nextDescription, { ...names, [String(clamped)]: cleanCourtName });
  }
  const { error } = await supabase
    .from("sessions")
    .update({ description: nextDescription, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true, courtCount: clamped };
}

/** The System Admin removes a player's profile photo (e.g. an inappropriate picture). Only the photo is cleared. */
export async function removePlayerPhoto(userId: string) {
  const auth = await requireSystemAdmin();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Player not found." };
  await deleteAvatar(userId);

  revalidatePath("/admin");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true };
}

/**
 * System Admin only: puts a player's password back to the shared starting password.
 * They must choose a new one the next time they sign in. Players without a sign-in
 * account (guests, walk-ins without an email) have no password to reset.
 */
export async function resetPlayerPassword(userId: string) {
  const auth = await requireSystemAdmin();
  if (auth.error) return { error: auth.error };

  const rateLimit = checkRateLimit(auth.context?.userId || "admin", "admin_password_reset", RATE_LIMIT_CONFIGS.ADMIN_ACTIONS);
  if (!rateLimit.success) return { error: rateLimit.error };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, display_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { error: "Player not found." };
  if (isRootSystemAdmin(target.email)) {
    return { error: "The System Admin password can't be reset here." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: DEFAULT_PASSWORD,
    app_metadata: { must_change_password: true },
  });
  if (error) {
    const noAccount = /not.?found|user_not_found/i.test(error.message);
    return {
      error: noAccount
        ? `${target.full_name || target.display_name || "This player"} has no sign-in account yet, so there's no password to reset.`
        : `The password couldn't be reset: ${error.message}`,
    };
  }

  revalidatePath("/admin");
  return { success: true as const };
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

  // is_active alone doesn't stop someone signing in, so also block (or unblock) the
  // sign-in account. A ban stops new sign-ins and token refreshes; the session they
  // already hold is refused by requireAuthenticatedUser and the database's is_admin().
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: isActive ? "none" : "876000h",
  });
  if (banError && !/not.?found|user_not_found/i.test(banError.message)) {
    console.error("togglePlayerActiveStatus ban error:", banError.message);
    return {
      error: isActive
        ? `The account was turned on, but signing in is still blocked: ${banError.message}`
        : `The account was turned off, but signing in couldn't be blocked: ${banError.message}`,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/rankings");
  revalidatePath("/profile");
  return { success: true };
}

export async function cancelSession(sessionId: string) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const supabase = await createClient();

  // Only this session's games, courts and line; a session live elsewhere is untouched.
  const closeError = await closeSession(supabase, sessionId, "cancelled");
  if (closeError) return { error: closeError };

  revalidatePath("/admin");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { success: true };
}

export async function editSession(sessionId: string, formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const rawTitle = formData.get("title") as string;
  const rawDescription = formData.get("description") as string;
  const rawLocation = (formData.get("location") as string) || "DCTECH Sports Arena";
  const rawVenueId = (formData.get("venueId") as string | null)?.trim() || null;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const maxPlayersStr = formData.get("maxPlayers") as string;
  const matchingStyle = sanitizeString((formData.get("matchingStyle") as string) || "balanced");
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
  const userDesc = sanitizeString(rawDescription || "");

  // A ranked session is employees only: refuse the switch while guests are going or in line.
  if (isRanked) {
    const supabase = await createClient();
    const [rsvpRes, queueRes] = await Promise.all([
      supabase.from("session_rsvps").select("player_id").eq("session_id", sessionId),
      supabase.from("queue_entries").select("player_id").eq("session_id", sessionId).neq("status", "left"),
    ]);
    const ids = Array.from(
      new Set([...(rsvpRes.data ?? []), ...(queueRes.data ?? [])].map((r) => r.player_id))
    );
    if (ids.length > 0) {
      const { data: people } = await supabase
        .from("profiles")
        .select("full_name, display_name, email, is_guest")
        .in("id", ids);
      const guests = blockedFromSession(people ?? [], true);
      if (guests.length > 0) {
        const names = guests.map((g) => g.display_name || g.full_name || "a guest").join(", ");
        return {
          error: `Guests can only play casual sessions. Remove ${names} from this session before making it ranked.`,
        };
      }
    }
  }

  // Metadata tags
  const usesSkillSpread = matchingStyle === "skill_separated" || matchingStyle === "skill_courts";
  const skillSpreadTag = usesSkillSpread
    ? ` [skill_spread:${parseSkillSpread(formData.get("skillSpread") as string | null)}]`
    : "";
  // This session's own court count; only touches the real courts if it is the live session.
  const courtCount = parseCourtCount(formData.get("courtCount") as string | null);
  const courtsTag = courtCount ? ` [courts:${courtCount}]` : "";
  const tags = `[matching_mode:${matchingStyle}] [ranked:${isRanked}] [target_points:${targetPoints}] [win_by:${winByTwo ? 2 : 1}] [scoring:${trackScores ? "points" : "result"}]${skillSpreadTag}${courtsTag} [partners:${formData.get("allowPartners") === "true"}]`;
  const finalDescription = userDesc ? `${userDesc} ${tags}` : tags;

  const supabase = await createClient();
  const { data: currentSession } = await supabase
    .from("sessions")
    .select("description")
    .eq("id", sessionId)
    .maybeSingle();
  const existingCourtNamesTag = extractCourtNamesTag(currentSession?.description);
  const fullDescription = existingCourtNamesTag
    ? `${finalDescription} ${existingCourtNamesTag}`
    : finalDescription;

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      title,
      description: fullDescription,
      location,
      venue_id: rawVenueId,
      start_time: parsePHTToISO(startTime),
      end_time: parsePHTToISO(endTime),
      max_players: maxPlayersStr ? Math.min(200, Math.max(2, parseInt(maxPlayersStr, 10))) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("status")
    .maybeSingle();

  if (error) return { error: error.message };

  if (courtCount && updated?.status === "active") {
    const courtRes = await setRentedCourtCount(courtCount, "Standard Court");
    if (courtRes?.error) {
      return { success: true, warning: `Saved, but the courts weren't changed: ${courtRes.error}` };
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true };
}

export async function updateSessionDetails(
  sessionId: string,
  title: string,
  description: string
) {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const cleanTitle = sanitizeString(title);
  if (!cleanTitle) {
    return { error: "Session name is required." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("sessions")
    .select("description")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Session not found." };

  const cleanDesc = sanitizeString(description || "");
  const finalDescription = mergeSessionDescription(existing.description, cleanDesc);

  const { error } = await supabase
    .from("sessions")
    .update({
      title: cleanTitle,
      description: finalDescription,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/");
  return { success: true, title: cleanTitle, description: cleanDesc };
}

export async function createWalkInPlayer(params: {
  fullName: string;
  email?: string;
  isGuest?: boolean;
  skillRating?: number;
  sessionId?: string;
  /** Also put them on this session's Who's going list, in the same step. */
  addToGoing?: boolean;
}) {
  // Server-side RBAC Guard
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };

  const validation = WalkInPlayerSchema.safeParse({
    name: params.fullName,
    email: params.email,
    type: params.isGuest ? "guest" : "employee",
    skillRating: params.skillRating || 2.0,
  });

  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid player details." };
  }

  const cleanName = validation.data.name;
  const providedEmail = validation.data.email;
  const supabase = await createClient();

  if (params.isGuest && !params.sessionId) {
    return { error: "Add a guest from inside a casual session." };
  }
  if (params.sessionId && (params.isGuest || params.addToGoing)) {
    const { data: targetSession } = await supabase
      .from("sessions")
      .select("description, status")
      .eq("id", params.sessionId)
      .maybeSingle();
    if (!targetSession) return { error: "Session not found." };
    if (params.isGuest && parseSessionMetadata(targetSession.description).isRanked) {
      return { error: GUEST_RANKED_MESSAGE };
    }
    // Check before creating anyone, so a closed session doesn't leave a stray account.
    if (params.addToGoing && !canRsvp(targetSession.status)) {
      return { error: "RSVPs close when the session starts." };
    }
  }

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

  const formattedName = params.isGuest
    ? cleanName.includes("(Guest)") ? cleanName : `${cleanName} (Guest)`
    : cleanName;

  // Every profile needs a sign-in account (profiles.id references auth.users), so
  // create the account first; with an email they can sign in and set a password.
  const created = await createPlayerAccount({
    fullName: formattedName,
    displayName: cleanName,
    email: providedEmail || undefined,
    rating: validation.data.skillRating,
    isGuest: Boolean(params.isGuest),
  });
  if (created.error || !created.id) {
    console.error("createWalkInPlayer error:", created.error);
    return { error: created.error || "The player couldn't be added." };
  }
  // Who's going, in the same step: if that fails, remove the new account so a retry
  // doesn't leave a duplicate behind (guests are hidden from the directory).
  if (params.addToGoing && params.sessionId) {
    const service = createAdminClient();
    const { error: rsvpError } = await service
      .from("session_rsvps")
      .upsert({ session_id: params.sessionId, player_id: created.id }, { onConflict: "session_id,player_id" });
    if (rsvpError) {
      await service.auth.admin.deleteUser(created.id);
      return { error: `The player couldn't be added to Who's going: ${rsvpError.message}` };
    }
    revalidatePath(`/sessions/${params.sessionId}`);
    revalidatePath("/");
  }

  const { data } = await supabase.from("profiles").select("*").eq("id", created.id).maybeSingle();

  revalidatePath("/admin");
  revalidatePath("/sessions");
  return { success: true, player: data };
}

const readAllEmployees = cache(async (): Promise<Profile[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true });

  if (error || !data) return [];
  return data as Profile[];
});

export async function getAllEmployees(): Promise<Profile[]> {
  return readAllEmployees();
}
