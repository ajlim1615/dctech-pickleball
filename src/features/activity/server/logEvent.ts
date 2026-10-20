import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionEventActorRole, SessionEventType } from "@/types";

/** The slice of the Supabase client this needs, so tests can pass a fake. */
export interface SupabaseLike {
  from(table: "session_events"): {
    insert(row: object): PromiseLike<{ error: { message: string } | null }>;
  };
}

export interface SessionEventInput {
  sessionId: string | null;
  type: SessionEventType;
  actorId: string;
  /** "self": a player acting on their own entry; "admin": an admin action; "system": an automatic follow-up. */
  actorRole: SessionEventActorRole;
  subjectIds?: string[];
  courtId?: string | null;
  matchId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Records one session event. Best-effort: a failed write is logged and ignored so
 * the action that caused it still succeeds. Server-only — not a server action, so
 * the browser can't call it.
 */
export async function logSessionEvent(supabase: SupabaseLike, event: SessionEventInput): Promise<void> {
  try {
    const { error } = await supabase.from("session_events").insert({
      session_id: event.sessionId,
      type: event.type,
      actor_id: event.actorId,
      actor_role: event.actorRole,
      subject_ids: event.subjectIds ?? [],
      court_id: event.courtId ?? null,
      match_id: event.matchId ?? null,
      details: event.details ?? {},
    });
    if (error) console.error(`Failed to log ${event.type}:`, error.message);
  } catch (err) {
    console.error(`Failed to log ${event.type}:`, err);
  }
}

type EventSource = SessionEventInput | (() => Promise<SessionEventInput | null>);

interface RecordDeps {
  schedule: (callback: () => Promise<void>) => void;
  client: () => SupabaseLike;
}

const defaultDeps: RecordDeps = {
  // After the response is sent, so logging never slows the action down.
  schedule: (callback) => after(callback),
  // Server-only service key: players can't write events themselves, so they can't forge them.
  client: () => createAdminClient() as unknown as SupabaseLike,
};

/**
 * Records a session event after the response is sent. Pass a builder function to do
 * any lookups (names, courts) off the critical path; return null to skip.
 */
export function recordSessionEvent(source: EventSource, deps: RecordDeps = defaultDeps): void {
  deps.schedule(async () => {
    try {
      const event = typeof source === "function" ? await source() : source;
      if (event) await logSessionEvent(deps.client(), event);
    } catch (err) {
      console.error("Failed to build session event:", err);
    }
  });
}
