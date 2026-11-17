import type { createClient } from "@/lib/supabase/server";
import { gameStateErrorMessage } from "@/features/matches/utils/gameStateErrors";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Ends or cancels one session in a single database transaction (close_session):
 * abandons its unfinished games, frees only the courts they held, and takes its
 * remaining entries out of the line. Other sessions are untouched.
 * Use the signed-in admin's client. Returns an error message, or null.
 */
export async function closeSession(
  supabase: SupabaseClient,
  sessionId: string,
  status: "completed" | "cancelled"
): Promise<string | null> {
  const { data, error } = await supabase.rpc("close_session", { p_session_id: sessionId, p_status: status });
  if (error) {
    console.error("close_session failed:", error.message);
    return gameStateErrorMessage(undefined);
  }
  const out = data as { error?: string } | null;
  return out?.error ? gameStateErrorMessage(out.error) : null;
}
