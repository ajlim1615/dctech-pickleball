import { describeRule, getWinner, resultOnlyScore, type ScoringRule } from "@/features/matches/utils/scoring";
import { DEFAULT_SKILL_SPREAD, decide, type PastGame } from "@/features/queue/matchmaking";
import { selectPlayersToRequeue } from "@/features/queue/utils/requeue";
import {
  type DeskGame,
  type DeskQueueEntry,
  type DeskSession,
  type EngineCtx,
  type EngineError,
  type GameResult,
  type SessionState,
  type Team,
} from "./types";

export interface Teams {
  teamA: string[];
  teamB: string[];
}

export type Suggestion = Teams | { waitingFor: number } | { hold: "no_skill_match" };

export function scoringRule(session: DeskSession): ScoringRule {
  return { targetPoints: session.targetScore, winByTwo: session.winBy2, trackScores: session.trackScores };
}

/** Waiting entries in line order. */
export function waitingLine(state: SessionState): DeskQueueEntry[] {
  return state.queue.filter((q) => q.status === "waiting").sort((a, b) => a.position - b.position);
}

export function activeGameOnCourt(state: SessionState, courtId: string): DeskGame | undefined {
  return state.games.find((g) => g.courtId === courtId && !g.endedAt);
}

function nextPosition(queue: DeskQueueEntry[]): number {
  return queue.reduce((max, q) => Math.max(max, q.position), 0) + 1;
}

/** Puts each player at the back of the line, in order. */
export function sendToBack(queue: DeskQueueEntry[], playerIds: string[]): DeskQueueEntry[] {
  let position = nextPosition(queue);
  const order = new Map(playerIds.map((id) => [id, position++]));
  return queue.map((q) =>
    order.has(q.playerId) ? { ...q, status: "waiting", position: order.get(q.playerId)! } : q
  );
}

/** Adds players to the back of the line. Anyone already waiting or playing is left alone. */
export function checkIn(state: SessionState, playerIds: string[], ctx: EngineCtx): SessionState {
  let queue = [...state.queue];
  const returning: string[] = [];
  for (const playerId of new Set(playerIds)) {
    if (!state.players[playerId]) continue;
    const existing = queue.find((q) => q.playerId === playerId);
    if (existing) {
      if (existing.status === "left" || existing.status === "on_break") returning.push(playerId);
      continue;
    }
    queue.push({
      id: ctx.newId(),
      sessionId: state.session.id,
      playerId,
      position: nextPosition(queue),
      status: "waiting",
      joinedAt: ctx.now,
      gamesPlayed: 0,
    });
  }
  queue = sendToBack(queue, returning);
  return { ...state, queue };
}

function pastGames(state: SessionState): PastGame[] {
  return state.games.flatMap((g) =>
    g.endedAt ? [{ courtId: g.courtId, teamA: g.teamA, teamB: g.teamB, winner: g.winner, endedAt: g.endedAt }] : []
  );
}

/**
 * The four matchmaking would put on this court next, or why nobody can yet. `force` skips the
 * skill-match hold (Start anyway).
 */
export function suggestGame(state: SessionState, courtId: string, random?: () => number, force = false): Suggestion {
  const decision = decide({
    style: state.session.matchingStyle,
    line: waitingLine(state).map((q) => ({ playerId: q.playerId, rating: state.players[q.playerId].skill, pairId: null })),
    history: pastGames(state),
    court: courtId,
    courts: state.session.courts.filter((c) => !c.closed).map((c) => c.id),
    settings: { skillSpread: state.session.skillSpread ?? DEFAULT_SKILL_SPREAD },
    random: random ?? Math.random,
    force,
  });
  if ("hold" in decision) {
    return decision.hold === "not_enough_players" ? { waitingFor: decision.needed } : { hold: "no_skill_match" };
  }
  return { teamA: [...decision.teamA], teamB: [...decision.teamB] };
}

/**
 * What each open, free court would get next, in court order. Players shown on one court
 * aren't offered to the next, so the suggestions never overlap. Courts in `forced` skip the skill hold.
 */
export function suggestAll(
  state: SessionState,
  random?: (courtId: string) => () => number,
  forced: ReadonlySet<string> = new Set()
): Record<string, Suggestion> {
  const result: Record<string, Suggestion> = {};
  let view = state;
  for (const court of state.session.courts) {
    if (court.closed || activeGameOnCourt(state, court.id)) continue;
    const suggestion = suggestGame(view, court.id, random?.(court.id), forced.has(court.id));
    result[court.id] = suggestion;
    if ("teamA" in suggestion) {
      const taken = [...suggestion.teamA, ...suggestion.teamB];
      view = {
        ...view,
        queue: view.queue.map((q) => (taken.includes(q.playerId) ? { ...q, status: "playing" } : q)),
      };
    }
  }
  return result;
}

export function startGame(state: SessionState, courtId: string, teams: Teams, ctx: EngineCtx): SessionState | EngineError {
  const court = state.session.courts.find((c) => c.id === courtId);
  if (!court) return { error: "That court doesn't exist." };
  if (court.closed) return { error: `${court.name} is closed.` };
  if (state.session.status !== "live") return { error: "Start the session first." };
  if (activeGameOnCourt(state, courtId)) return { error: `${court.name} already has a game.` };

  const playerIds = [...teams.teamA, ...teams.teamB];
  if (teams.teamA.length !== 2 || teams.teamB.length !== 2 || new Set(playerIds).size !== 4) {
    return { error: "A game needs four different players." };
  }
  for (const id of playerIds) {
    const entry = state.queue.find((q) => q.playerId === id);
    if (!entry || entry.status !== "waiting") {
      return { error: `${state.players[id]?.name ?? "A player"} isn't waiting in line.` };
    }
  }

  const game: DeskGame = {
    id: ctx.newId(),
    sessionId: state.session.id,
    courtId,
    teamA: [...teams.teamA],
    teamB: [...teams.teamB],
    winner: null,
    startedAt: ctx.now,
  };
  return {
    ...state,
    games: [...state.games, game],
    queue: state.queue.map((q) => (playerIds.includes(q.playerId) ? { ...q, status: "playing" } : q)),
  };
}

/** Turns a tap or a typed score into the stored score, or explains why it isn't a finished game. */
export function resolveResult(
  session: DeskSession,
  result: GameResult
): { scoreA: number; scoreB: number; winner: Team } | EngineError {
  if ("winner" in result) return { ...resultOnlyScore(result.winner), winner: result.winner };
  const rule = scoringRule(session);
  const winner = getWinner(result.scoreA, result.scoreB, rule);
  if (!winner) {
    return { error: `${result.scoreA}-${result.scoreB} doesn't finish a game (${describeRule(rule)}).` };
  }
  return { scoreA: result.scoreA, scoreB: result.scoreB, winner };
}

/** Records the result, sends the players back in line (or home, or on break), then refills courts. */
export function finishGame(state: SessionState, gameId: string, result: GameResult, ctx: EngineCtx): SessionState | EngineError {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return { error: "That game doesn't exist." };
  if (game.endedAt) return { error: "That game is already finished." };
  const resolved = resolveResult(state.session, result);
  if ("error" in resolved) return resolved;

  const playerIds = [...game.teamA, ...game.teamB];
  let queue = state.queue.map((q): DeskQueueEntry => {
    if (!playerIds.includes(q.playerId)) return q;
    const played = { ...q, gamesPlayed: q.gamesPlayed + 1, leaveAfterGame: false, breakAfterGame: false };
    if (q.leaveAfterGame) return { ...played, status: "left" };
    if (q.breakAfterGame) return { ...played, status: "on_break" };
    return played;
  });

  const rejoining = selectPlayersToRequeue({
    matchPlayerIds: playerIds,
    checkedInIds: queue.filter((q) => q.status === "playing" && playerIds.includes(q.playerId)).map((q) => q.playerId),
    activeQueueIds: queue.filter((q) => q.status === "waiting").map((q) => q.playerId),
  }).map((e) => e.player_id);
  queue = sendToBack(queue, rejoining);

  const finished: DeskGame = { ...game, ...resolved, endedAt: ctx.now };
  const next = { ...state, queue, games: state.games.map((g) => (g.id === gameId ? finished : g)) };
  // The court that just finished goes first, so its winners stay there in winners-stay modes.
  return refillCourts(next, ctx, game.courtId);
}

/** Fixes a finished game's result. Only the game record changes; nobody moves. */
export function correctResult(state: SessionState, gameId: string, result: GameResult, ctx: EngineCtx): SessionState | EngineError {
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return { error: "That game doesn't exist." };
  if (!game.endedAt) return { error: "Finish the game before fixing its result." };
  const resolved = resolveResult(state.session, result);
  if ("error" in resolved) return resolved;
  return {
    ...state,
    games: state.games.map((g) => (g.id === gameId ? { ...g, ...resolved, correctedAt: ctx.now } : g)),
  };
}

/**
 * Starts the suggested game on every open, free court that has enough players waiting.
 * `firstCourtId` is filled before the others.
 */
export function refillCourts(state: SessionState, ctx: EngineCtx, firstCourtId?: string): SessionState {
  if (state.session.status !== "live") return state;
  let next = state;
  const courts = [...state.session.courts].sort(
    (a, b) => Number(b.id === firstCourtId) - Number(a.id === firstCourtId)
  );
  for (const court of courts) {
    if (court.closed || activeGameOnCourt(next, court.id)) continue;
    const suggestion = suggestGame(next, court.id, ctx.random);
    // A held court stays empty; later courts may still start (King/Queen holds per court).
    if (!("teamA" in suggestion)) continue;
    const started = startGame(next, court.id, suggestion, ctx);
    if ("error" in started) continue;
    next = started;
  }
  return next;
}
