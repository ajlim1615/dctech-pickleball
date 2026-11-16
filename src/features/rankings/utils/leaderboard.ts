import type { Profile } from "@/types";
import { RATING_RULES, type RatingRules } from "../ratingConfig";

export interface PlayerTotals {
  player_id: string;
  games: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
}

export interface RankedPlayer extends Profile {
  /**
   * For qualified players, a shared ("competition") rank: players level on rating, win
   * rate and wins share a number, and the next one skips (1, 2, 2, 4). Null for players
   * still earning their first ranked games.
   */
  rank: number | null;
  /** Shares their rank with at least one other player. */
  tied: boolean;
  games_played: number;
  games_won: number;
  games_lost: number;
  win_rate: number;
  qualified: boolean;
  gamesToQualify: number;
}

const nameOf = (p: Profile) => (p.full_name || p.display_name || "").toLowerCase();

const winRatio = (p: { games_won: number; games_played: number }) =>
  p.games_played > 0 ? p.games_won / p.games_played : 0;

export function buildLeaderboard(
  profiles: Profile[],
  totals: PlayerTotals[],
  rules: RatingRules = RATING_RULES,
): RankedPlayer[] {
  const byPlayer = new Map(totals.map((t) => [t.player_id, t]));

  const players = profiles.map((profile) => {
    const t = byPlayer.get(profile.id);
    const games = Number(t?.games ?? 0);
    const wins = Number(t?.wins ?? 0);
    const losses = Number(t?.losses ?? 0);
    const qualified = games >= rules.qualifyGames;
    return {
      ...profile,
      skill_rating: Number(profile.skill_rating ?? rules.start),
      games_played: games,
      games_won: wins,
      games_lost: losses,
      win_rate: games > 0 ? Math.round((wins / games) * 100) : 0,
      qualified,
      gamesToQualify: Math.max(0, rules.qualifyGames - games),
      rank: null as number | null,
      tied: false,
    };
  });

  // Rating, win rate and wins decide the order; name only orders players who are tied.
  const standing = (a: (typeof players)[number], b: (typeof players)[number]) =>
    b.skill_rating - a.skill_rating || winRatio(b) - winRatio(a) || b.games_won - a.games_won;

  const sorted = players
    .filter((p) => p.qualified)
    .sort((a, b) => standing(a, b) || nameOf(a).localeCompare(nameOf(b)));

  const ranked = sorted.map((p, i) => {
    let first = i;
    while (first > 0 && standing(sorted[first - 1], p) === 0) first--;
    const tied =
      (i > 0 && standing(sorted[i - 1], p) === 0) ||
      (i < sorted.length - 1 && standing(sorted[i + 1], p) === 0);
    return { ...p, rank: first + 1, tied };
  });

  const unranked = players
    .filter((p) => !p.qualified)
    .sort((a, b) => b.games_played - a.games_played || nameOf(a).localeCompare(nameOf(b)));

  return [...ranked, ...unranked];
}
