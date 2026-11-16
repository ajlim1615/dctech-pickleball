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
  /** 1..n for qualified players, null for players still earning their first ranked games. */
  rank: number | null;
  games_played: number;
  games_won: number;
  games_lost: number;
  win_rate: number;
  qualified: boolean;
  gamesToQualify: number;
}

const nameOf = (p: Profile) => (p.full_name || p.display_name || "").toLowerCase();

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
    };
  });

  const ranked = players
    .filter((p) => p.qualified)
    .sort(
      (a, b) =>
        b.skill_rating - a.skill_rating ||
        b.games_won / b.games_played - a.games_won / a.games_played ||
        b.games_won - a.games_won ||
        nameOf(a).localeCompare(nameOf(b)),
    )
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const unranked = players
    .filter((p) => !p.qualified)
    .sort((a, b) => b.games_played - a.games_played || nameOf(a).localeCompare(nameOf(b)));

  return [...ranked, ...unranked];
}
