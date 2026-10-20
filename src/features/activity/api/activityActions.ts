"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/security/authGuard";
import type { AdminAuditEvent, SessionEvent, SessionEventType } from "@/types";

// Every column players may read; actor_id is deliberately left out.
const PUBLIC_COLUMNS = "id, session_id, type, actor_role, subject_ids, court_id, match_id, details, created_at";

/** The session's activity, newest first. Empty if the table isn't set up yet. */
export async function getSessionFeed(sessionId: string, limit = 50): Promise<SessionEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_events")
    .select(PUBLIC_COLUMNS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as SessionEvent[];
}

/** Average length of this session's finished games, in whole minutes; null when none yet. */
export async function getAverageGameMinutes(sessionId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("started_at, ended_at")
    .eq("session_id", sessionId)
    .eq("status", "completed");
  const durations = (data || [])
    .filter((m) => m.started_at && m.ended_at)
    .map((m) => (new Date(m.ended_at!).getTime() - new Date(m.started_at!).getTime()) / 60000)
    .filter((min) => min > 0 && min < 120);
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((sum, min) => sum + min, 0) / durations.length);
}

/** Admin audit: events with who did them. */
export async function getAdminAudit(filters: {
  sessionId?: string;
  types?: SessionEventType[];
  limit?: number;
}): Promise<AdminAuditEvent[]> {
  const auth = await requireAdminUser();
  if (auth.error) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_audit", {
    p_session_id: filters.sessionId ?? null,
    p_types: filters.types && filters.types.length > 0 ? filters.types : null,
    p_limit: filters.limit ?? 200,
  });
  if (error || !data) return [];
  return data as AdminAuditEvent[];
}
