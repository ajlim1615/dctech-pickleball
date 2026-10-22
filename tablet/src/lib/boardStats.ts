import type { SessionState } from "../engine/types";

/** The live counts in the board header. */
export function boardStats(state: SessionState): { playing: number; inLine: number; games: number } {
  return {
    playing: state.queue.filter((q) => q.status === "playing").length,
    inLine: state.queue.filter((q) => q.status === "waiting").length,
    games: state.games.filter((g) => g.endedAt && g.winner).length,
  };
}
