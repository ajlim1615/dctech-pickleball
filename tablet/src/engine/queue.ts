import { refillCourts, sendToBack, waitingLine } from "./game";
import type { EngineCtx, EngineError, SessionState } from "./types";

function entryFor(state: SessionState, playerId: string) {
  return state.queue.find((q) => q.playerId === playerId);
}

/** Moves a waiting player to a new place in line (0 = front). */
export function moveInQueue(state: SessionState, entryId: string, toIndex: number): SessionState | EngineError {
  const line = waitingLine(state);
  const from = line.findIndex((q) => q.id === entryId);
  if (from === -1) return { error: "Only players waiting in line can be moved." };
  const positions = line.map((q) => q.position);
  const reordered = [...line];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(Math.max(0, Math.min(toIndex, reordered.length)), 0, moved);
  const newPosition = new Map(reordered.map((q, i) => [q.id, positions[i]]));
  return {
    ...state,
    queue: state.queue.map((q) => (newPosition.has(q.id) ? { ...q, position: newPosition.get(q.id)! } : q)),
  };
}

/** Starts or ends a break. Someone playing goes on break when their game finishes. */
export function setBreak(state: SessionState, playerId: string, onBreak: boolean, ctx: EngineCtx): SessionState | EngineError {
  const entry = entryFor(state, playerId);
  if (!entry) return { error: "That player isn't checked in." };

  if (onBreak) {
    if (entry.status === "playing") {
      return { ...state, queue: state.queue.map((q) => (q.id === entry.id ? { ...q, breakAfterGame: true } : q)) };
    }
    if (entry.status !== "waiting") return { error: "Only players in line can take a break." };
    return { ...state, queue: state.queue.map((q) => (q.id === entry.id ? { ...q, status: "on_break" } : q)) };
  }

  if (entry.status === "playing") {
    return { ...state, queue: state.queue.map((q) => (q.id === entry.id ? { ...q, breakAfterGame: false } : q)) };
  }
  if (entry.status !== "on_break") return { error: "That player isn't on a break." };
  return refillCourts({ ...state, queue: sendToBack(state.queue, [playerId]) }, ctx);
}

/** Marks a player gone home. Someone playing finishes their game first. */
export function markLeft(state: SessionState, playerId: string, ctx: EngineCtx): SessionState | EngineError {
  void ctx;
  const entry = entryFor(state, playerId);
  if (!entry) return { error: "That player isn't checked in." };
  if (entry.status === "left") return state;
  return {
    ...state,
    queue: state.queue.map((q) =>
      q.id !== entry.id ? q : q.status === "playing" ? { ...q, leaveAfterGame: true } : { ...q, status: "left" }
    ),
  };
}

/** Swaps someone waiting into an unfinished game. The player taken out goes to the front of the line. */
export function swapPlayerInGame(
  state: SessionState,
  gameId: string,
  outId: string,
  inId: string,
  ctx: EngineCtx
): SessionState | EngineError {
  void ctx;
  const game = state.games.find((g) => g.id === gameId);
  if (!game) return { error: "That game doesn't exist." };
  if (game.endedAt) return { error: "That game is already finished." };
  if (![...game.teamA, ...game.teamB].includes(outId)) return { error: "That player isn't in this game." };
  if (entryFor(state, inId)?.status !== "waiting") {
    return { error: `${state.players[inId]?.name ?? "That player"} isn't waiting in line.` };
  }

  const front = Math.min(...state.queue.map((q) => q.position)) - 1;
  const swap = (team: string[]) => team.map((id) => (id === outId ? inId : id));
  return {
    ...state,
    games: state.games.map((g) => (g.id === gameId ? { ...g, teamA: swap(g.teamA), teamB: swap(g.teamB) } : g)),
    queue: state.queue.map((q) => {
      if (q.playerId === inId) return { ...q, status: "playing" };
      if (q.playerId === outId) {
        return { ...q, status: "waiting", position: front, leaveAfterGame: false, breakAfterGame: false };
      }
      return q;
    }),
  };
}

/** Closes or reopens a court. A game already running carries on; reopening fills the court. */
export function setCourtClosed(state: SessionState, courtId: string, closed: boolean, ctx: EngineCtx): SessionState | EngineError {
  if (!state.session.courts.some((c) => c.id === courtId)) return { error: "That court doesn't exist." };
  const next = {
    ...state,
    session: {
      ...state.session,
      courts: state.session.courts.map((c) => (c.id === courtId ? { ...c, closed } : c)),
    },
  };
  return closed ? next : refillCourts(next, ctx);
}

/** Ends the session. Games still running are kept with no winner. */
export function endSession(state: SessionState, ctx: EngineCtx): SessionState | EngineError {
  if (state.session.status === "ended") return { error: "This session has already ended." };
  return { ...state, session: { ...state.session, status: "ended", endedAt: ctx.now } };
}
