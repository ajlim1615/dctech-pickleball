"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/security/authGuard";
import { parseSessionMetadata } from "@/lib/utils";
import { gameStateErrorMessage } from "@/features/matches/utils/gameStateErrors";
import { MATCH_COURT } from "@/features/matches/utils/queryShapes";
import { recordSessionEvent } from "@/features/activity/server/logEvent";
import { afterLineChange } from "@/features/queue/server/afterLineChange";
import { pickReplacement } from "@/features/queue/upNext/buildCards";
import type { SessionEventType } from "@/types";

type Team = "team_a" | "team_b";
export type CourtChangeResult =
  | { success: true; changeId: string | null; unpaired: string[]; abandoned?: boolean; replacementId?: string }
  | { error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;
type MatchInfo = { sessionId: string; courtId: string | null; courtName: string | null };

async function matchInfo(supabase: Supabase, matchId: string): Promise<MatchInfo | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(`session_id, court_id, ${MATCH_COURT} ( name )`)
    .eq("id", matchId)
    .maybeSingle();
  if (error) {
    console.error("matchInfo failed:", error.message);
    return null;
  }
  if (!data?.session_id) return null;
  return {
    sessionId: data.session_id,
    courtId: data.court_id,
    courtName: (data.court as unknown as { name: string } | null)?.name ?? null,
  };
}

/**
 * Runs one live-court procedure, logs its event and refreshes the line and cards.
 * `event` gets the procedure's output so it can name who came in.
 */
async function runCourtChange(
  matchId: string,
  rpc: (supabase: Supabase) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  event: (out: Record<string, unknown>) => { type: SessionEventType; subjectIds: string[]; details?: Record<string, unknown> }
): Promise<CourtChangeResult> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  const supabase = await createClient();
  const info = await matchInfo(supabase, matchId);
  if (!info) return { error: gameStateErrorMessage("not_found") };

  const { data, error } = await rpc(supabase);
  if (error) {
    console.error("court change failed:", error.message);
    return { error: gameStateErrorMessage(undefined) };
  }
  const out = (data ?? {}) as Record<string, unknown>;
  if (typeof out.error === "string") return { error: gameStateErrorMessage(out.error) };

  const e = event(out);
  recordSessionEvent({
    sessionId: info.sessionId,
    type: e.type,
    actorId: auth.context!.userId,
    actorRole: "admin",
    subjectIds: e.subjectIds,
    courtId: info.courtId,
    matchId,
    details: { courtName: info.courtName, ...e.details },
  });
  await afterLineChange(info.sessionId, info.courtId ? [`/courts/${info.courtId}/monitor`] : []);

  return {
    success: true,
    changeId: (out.change_id as string | null) ?? null,
    unpaired: (out.unpaired as string[] | null) ?? [],
    ...(out.abandoned ? { abandoned: true } : {}),
    ...(typeof out.replacement_id === "string" ? { replacementId: out.replacement_id } : {}),
  };
}

/** Someone from the line comes in; the player who comes off goes to the back of the line. */
export async function replacePlayer(matchId: string, outId: string, inId: string) {
  return runCourtChange(
    matchId,
    (s) => s.rpc("replace_match_player", { p_match_id: matchId, p_out: outId, p_in: inId }),
    () => ({ type: "court_player_replaced", subjectIds: [outId, inId], details: { out: outId, in: inId } })
  );
}

export async function switchTeams(matchId: string, playerId1: string, playerId2: string) {
  return runCourtChange(
    matchId,
    (s) => s.rpc("switch_match_teams", { p_match_id: matchId, p_player_1: playerId1, p_player_2: playerId2 }),
    () => ({ type: "court_teams_switched", subjectIds: [playerId1, playerId2] })
  );
}

/** The player goes to the front of the line; the slot stays empty. */
export async function removeFromCourt(matchId: string, playerId: string) {
  return runCourtChange(
    matchId,
    (s) => s.rpc("remove_match_player", { p_match_id: matchId, p_player: playerId }),
    () => ({ type: "court_player_removed", subjectIds: [playerId], details: { out: playerId } })
  );
}

export async function fillSlot(matchId: string, team: Team, playerId: string) {
  return runCourtChange(
    matchId,
    (s) => s.rpc("fill_match_slot", { p_match_id: matchId, p_team: team, p_player: playerId }),
    () => ({ type: "court_slot_filled", subjectIds: [playerId], details: { in: playerId, team } })
  );
}

/** No-show: the next in line (or `inId`) comes in; the no-show goes on a break. */
export async function markNoShow(matchId: string, playerId: string, inId?: string) {
  return runCourtChange(
    matchId,
    (s) => s.rpc("swap_match_player", { p_match_id: matchId, p_out: playerId, p_in: inId ?? null }),
    (out) => {
      const replacement = out.replacement_id as string;
      return { type: "no_show_swapped", subjectIds: [playerId, replacement], details: { out: playerId, in: replacement } };
    }
  );
}

export async function undoCourtChange(matchId: string, changeId: string) {
  return runCourtChange(
    matchId,
    (s) => s.rpc("undo_court_change", { p_change_id: changeId }),
    () => ({ type: "court_change_undone", subjectIds: [], details: { changeId } })
  );
}

/** Who Auto-pick would choose for an open slot on `team` (or to replace `outId`). */
async function bestFor(supabase: Supabase, matchId: string, team: Team, outId?: string): Promise<string | null> {
  const info = await matchInfo(supabase, matchId);
  if (!info) return null;
  const [{ data: session }, { data: roster }, { data: waiting }, { data: carded }] = await Promise.all([
    supabase.from("sessions").select("description").eq("id", info.sessionId).maybeSingle(),
    supabase.from("match_players").select("player_id, team, player:profiles ( skill_rating )").eq("match_id", matchId),
    supabase
      .from("queue_entries")
      .select("player_id, group_id, player:profiles ( skill_rating )")
      .eq("session_id", info.sessionId)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true }),
    supabase.from("up_next_players").select("player_id").eq("session_id", info.sessionId),
  ]);
  const rating = (p: unknown) => (p as { skill_rating: number | null } | null)?.skill_rating ?? undefined;
  const staying = (roster ?? []).filter((r) => r.player_id !== outId);
  const ratings: Record<string, number> = {};
  for (const r of staying) {
    const v = rating(r.player);
    if (v !== undefined) ratings[r.player_id] = v;
  }
  return pickReplacement({
    style: parseSessionMetadata(session?.description).matchingMode,
    line: (waiting ?? []).map((q) => ({ playerId: q.player_id, rating: rating(q.player) ?? null, pairId: q.group_id })),
    staying: {
      teamA: staying.filter((r) => r.team === "team_a").map((r) => r.player_id),
      teamB: staying.filter((r) => r.team === "team_b").map((r) => r.player_id),
    },
    missingTeam: team,
    inCards: new Set((carded ?? []).map((c) => c.player_id)),
    random: Math.random,
    ratings,
  });
}

/** Replace with whoever Auto-pick chooses. */
export async function autoPickReplacement(matchId: string, outId: string): Promise<CourtChangeResult> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  const supabase = await createClient();
  const { data: out } = await supabase.from("match_players").select("team").eq("match_id", matchId).eq("player_id", outId).maybeSingle();
  if (!out) return { error: gameStateErrorMessage("not_in_game") };
  const inId = await bestFor(supabase, matchId, out.team as Team, outId);
  if (!inId) return { error: gameStateErrorMessage("no_replacement") };
  return replacePlayer(matchId, outId, inId);
}

/** Fill one empty slot on `team` with whoever Auto-pick chooses. */
export async function autoFillSlot(matchId: string, team: Team): Promise<CourtChangeResult> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  const supabase = await createClient();
  const inId = await bestFor(supabase, matchId, team);
  if (!inId) return { error: gameStateErrorMessage("no_replacement") };
  return fillSlot(matchId, team, inId);
}
