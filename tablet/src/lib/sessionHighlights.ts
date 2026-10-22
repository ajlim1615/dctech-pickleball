import { sessionLeaderboard } from "../engine/leaderboard";
import type { SessionState } from "../engine/types";

/** "18 games · top: Ana Cruz 5–0" for a past session row. */
export function sessionHighlights(state: SessionState): {
  games: number;
  top?: { name: string; won: number; lost: number };
} {
  const games = state.games.filter((g) => g.endedAt && g.winner).length;
  const leader = sessionLeaderboard(state)[0];
  if (!leader || leader.games_played === 0) return { games };
  return { games, top: { name: leader.display_name, won: leader.games_won, lost: leader.games_lost } };
}
