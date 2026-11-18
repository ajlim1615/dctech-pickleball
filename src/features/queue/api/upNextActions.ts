"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/security/authGuard";
import { parseSessionMetadata } from "@/lib/utils";
import { seededRandom, type LineEntry } from "@/features/queue/matchmaking";
import { loadOpenCourtIds, loadSessionHistory } from "@/features/queue/api/matchmakingData";
import { autoCardCount, buildAutoCards } from "@/features/queue/upNext/buildCards";
import { sameAutoCards, toUpNextCards, type UpNextCard, type UpNextCardRow, type UpNextPlayerRow } from "@/features/queue/upNext/types";
import { gameStateErrorMessage } from "@/features/matches/utils/gameStateErrors";
import { recordSessionEvent } from "@/features/activity/server/logEvent";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Result<T = object> = ({ success: true } & T) | { error: string };

/** Every style plays doubles today; singles cards are supported by the database for later. */
const PER_SIDE = 2 as const;

async function loadCards(supabase: Supabase, sessionId: string): Promise<UpNextCard[]> {
  const [{ data: cards }, { data: players }] = await Promise.all([
    supabase.from("up_next_matches").select("id, position, per_side, target_court_id, is_auto").eq("session_id", sessionId),
    supabase.from("up_next_players").select("card_id, player_id, team, slot, player:profiles ( full_name, display_name )").eq("session_id", sessionId),
  ]);
  return toUpNextCards((cards ?? []) as UpNextCardRow[], (players ?? []) as unknown as UpNextPlayerRow[]);
}

function rpcError(out: unknown, error: { message: string } | null, label: string): string | null {
  if (error) {
    console.error(`${label} failed:`, error.message);
    return gameStateErrorMessage(undefined);
  }
  const code = (out as { error?: string } | null)?.error;
  return code ? gameStateErrorMessage(code) : null;
}

/** The cards for a session, for any signed-in viewer. */
export async function getUpNext(sessionId: string): Promise<UpNextCard[]> {
  const supabase = await createClient();
  return loadCards(supabase, sessionId);
}

/**
 * Rebuilds the auto cards from the current line (hand-edited cards are kept, and their
 * players left out). Admins only; does nothing for anyone else or when nothing changed.
 * `reshuffle` uses a fresh random draw (the Rebuild button); otherwise the same line
 * always gives the same cards, so they don't jump around between refreshes.
 */
export async function refreshUpNext(sessionId: string, options: { reshuffle?: boolean } = {}): Promise<void> {
  const auth = await requireAdminUser();
  if (auth.error) return;
  const supabase = await createClient();

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: session } = await supabase.from("sessions").select("status, description").eq("id", sessionId).maybeSingle();
    if (!session || session.status !== "active") return;
    const { matchingMode, skillSpread, courtCount } = parseSessionMetadata(session.description);

    const { data: version } = await supabase.rpc("up_next_line_version", { p_session_id: sessionId });
    const [{ data: waiting }, history, courts, cards] = await Promise.all([
      supabase
        .from("queue_entries")
        .select("id, player_id, group_id, joined_at, player:profiles ( skill_rating )")
        .eq("session_id", sessionId)
        .eq("status", "waiting")
        .order("joined_at", { ascending: true }),
      loadSessionHistory(supabase, sessionId),
      loadOpenCourtIds(supabase),
      loadCards(supabase, sessionId),
    ]);

    const manual = cards.filter((c) => !c.isAuto);
    const line: LineEntry[] = (waiting ?? []).map((q) => ({
      playerId: q.player_id,
      rating: (q.player as unknown as { skill_rating: number | null } | null)?.skill_rating ?? null,
      pairId: q.group_id,
    }));
    const seed = (waiting ?? []).map((q) => q.id).join("|");
    const built = buildAutoCards({
      style: matchingMode,
      line,
      history,
      courts,
      count: autoCardCount(courtCount ?? courts.length, cards),
      perSide: PER_SIDE,
      exclude: new Set(manual.flatMap((c) => [...c.teamA, ...c.teamB])),
      settings: { skillSpread },
      random: options.reshuffle ? Math.random : seededRandom(seed),
    });
    if (!options.reshuffle && sameAutoCards(cards, built)) return;

    const { data, error } = await supabase.rpc("replace_auto_up_next", {
      p_session_id: sessionId,
      p_cards: built.map((c) => ({ team_a: c.teamA, team_b: c.teamB, per_side: PER_SIDE, target_court_id: c.targetCourtId })),
      p_line_version: (version as string | null) ?? "",
    });
    if (error) {
      console.error("replace_auto_up_next failed:", error.message);
      return;
    }
    if ((data as { error?: string } | null)?.error !== "line_changed") return;
  }
}

/** The Rebuild button: a fresh draw for every auto card. */
export async function rebuildUpNext(sessionId: string): Promise<Result> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  await refreshUpNext(sessionId, { reshuffle: true });
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

/** Creates (cardId null) or edits a card. The card becomes hand-edited and is kept as is. */
export async function saveUpNextCard(
  sessionId: string,
  cardId: string | null,
  teamA: string[],
  teamB: string[],
  /** Keep a court-bound (King/Queen) card on its court. */
  targetCourtId: string | null = null
): Promise<Result<{ cardId: string; unpaired: string[] }>> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_up_next_card", {
    p_session_id: sessionId,
    p_card_id: cardId,
    p_team_a: teamA,
    p_team_b: teamB,
    p_per_side: PER_SIDE,
    p_target_court_id: targetCourtId,
  });
  const failed = rpcError(data, error, "save_up_next_card");
  if (failed) return { error: failed };
  const out = data as { card_id: string; unpaired?: string[] };

  recordSessionEvent({
    sessionId,
    type: "up_next_edited",
    actorId: auth.context!.userId,
    actorRole: "admin",
    subjectIds: [...teamA, ...teamB],
    details: { cardId: out.card_id },
  });
  await refreshUpNext(sessionId);
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, cardId: out.card_id, unpaired: out.unpaired ?? [] };
}

export async function deleteUpNextCard(sessionId: string, cardId: string): Promise<Result> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_up_next_card", { p_card_id: cardId });
  const failed = rpcError(data, error, "delete_up_next_card");
  if (failed) return { error: failed };
  await refreshUpNext(sessionId);
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

async function logGameStarted(supabase: Supabase, sessionId: string, courtId: string, matchId: string, actorId: string) {
  recordSessionEvent(async () => {
    const [{ data: court }, { data: players }] = await Promise.all([
      supabase.from("courts").select("name").eq("id", courtId).maybeSingle(),
      supabase.from("match_players").select("player_id, team").eq("match_id", matchId),
    ]);
    const teamA = (players ?? []).filter((p) => p.team === "team_a").map((p) => p.player_id);
    const teamB = (players ?? []).filter((p) => p.team === "team_b").map((p) => p.player_id);
    return {
      sessionId,
      type: "game_started",
      actorId,
      actorRole: "admin",
      subjectIds: [...teamA, ...teamB],
      courtId,
      matchId,
      details: { courtName: court?.name ?? null, teamA, teamB },
    };
  });
}

async function startOnCourt(
  sessionId: string,
  courtId: string,
  args: { teamA: string[]; teamB: string[]; cardId: string | null },
  options: { refresh?: boolean } = {}
): Promise<Result<{ matchId: string }>> {
  const auth = await requireAdminUser();
  if (auth.error) return { error: auth.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_match", {
    p_session_id: sessionId,
    p_court_id: courtId,
    p_team_a: args.teamA,
    p_team_b: args.teamB,
    p_from_queue: true,
    p_up_next_id: args.cardId,
  });
  const failed = rpcError(data, error, "start_match");
  if (failed) return { error: failed };
  const matchId = (data as { match_id: string }).match_id;

  await logGameStarted(supabase, sessionId, courtId, matchId, auth.context!.userId);
  // Several starts in a row (Fill open courts) refresh once at the end instead, so the
  // remaining cards keep their ids.
  if (options.refresh !== false) await refreshUpNext(sessionId);
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/courts/${courtId}/monitor`);
  revalidatePath("/");
  return { success: true, matchId };
}

/** Start or Send to Court: the card's players start on this court and the card goes away. */
export async function sendUpNextToCourt(
  sessionId: string,
  cardId: string,
  courtId: string,
  options: { refresh?: boolean } = {}
) {
  return startOnCourt(sessionId, courtId, { teamA: [], teamB: [], cardId }, options);
}

/** Choose Players: start exactly these teams (all must be waiting in line). */
export async function startChosenPlayers(sessionId: string, courtId: string, teamA: string[], teamB: string[]) {
  return startOnCourt(sessionId, courtId, { teamA, teamB, cardId: null });
}
