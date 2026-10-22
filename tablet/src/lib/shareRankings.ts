import { sessionLeaderboard } from "../engine/leaderboard";
import type { SessionState } from "../engine/types";

export const MIN_RANKED_GAMES = 3;
export const MAX_CARD_ROWS = 12;

export interface ShareRow {
  id: string;
  name: string;
  won: number;
  lost: number;
  diff: number;
}

/**
 * The rows on the share card. Players with at least 3 finished games are ranked; the rest
 * are provisional. Both lists go by wins, then point difference (when scores are kept), then name.
 */
export function shareRankings(
  state: SessionState,
  { minGames = MIN_RANKED_GAMES, maxRows = MAX_CARD_ROWS } = {}
): { players: number; games: number; ranked: ShareRow[]; provisional: ShareRow[]; more: number } {
  const useDiff = state.session.trackScores;
  const rows = sessionLeaderboard(state)
    .filter((r) => r.games_played > 0)
    .map((r) => ({ id: r.id, name: r.display_name, won: r.games_won, lost: r.games_lost, diff: r.point_diff, played: r.games_played }))
    .sort((a, b) => b.won - a.won || (useDiff ? b.diff - a.diff : 0) || a.name.localeCompare(b.name));

  const strip = ({ played: _, ...row }: (typeof rows)[number]): ShareRow => row;
  const ranked = rows.filter((r) => r.played >= minGames).map(strip);
  const provisional = rows.filter((r) => r.played < minGames).map(strip);
  const shownRanked = ranked.slice(0, maxRows);
  const shownProvisional = provisional.slice(0, Math.max(0, maxRows - shownRanked.length));

  return {
    players: rows.length,
    games: state.games.filter((g) => g.endedAt && g.winner).length,
    ranked: shownRanked,
    provisional: shownProvisional,
    more: rows.length - shownRanked.length - shownProvisional.length,
  };
}
