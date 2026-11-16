import { createClient } from "@/lib/supabase/server";
import type { QueueLimits } from "@/features/queue/utils/queueLimits";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * How many breaks and self-leaves a player used in a session, from session events.
 * Events are written only by the server (service key), so players can't erase them.
 * A failed read counts as nothing used, so a database hiccup never locks anyone out.
 */
export async function loadQueueLimits(supabase: Client, sessionId: string, playerId: string): Promise<QueueLimits> {
  const { data, error } = await supabase
    .from("session_events")
    .select("type, details")
    .eq("session_id", sessionId)
    .eq("actor_role", "self")
    .in("type", ["break_started", "left_queue", "checked_out"])
    .contains("subject_ids", [playerId]);
  if (error || !data) {
    if (error) console.error("loadQueueLimits failed:", error.message);
    return { breaksTaken: 0, timesLeft: 0 };
  }
  return {
    breaksTaken: data.filter((e) => e.type === "break_started").length,
    // A self check-out only counts when it actually took the player out of line.
    timesLeft: data.filter(
      (e) =>
        e.type === "left_queue" ||
        (e.type === "checked_out" && (e.details as { left_line?: boolean } | null)?.left_line === true)
    ).length,
  };
}
