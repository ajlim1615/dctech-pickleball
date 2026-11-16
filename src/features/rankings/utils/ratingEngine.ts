/**
 * Rating updates for ranked games, on the app's DUPR-style scale (bounds come
 * from RATING_RULES.min / .max in ratingConfig).
 *
 * Elo-style: each team's strength is its players' average rating, the expected
 * result comes from the rating gap, and every player moves by
 * K × (actual − expected). Pure so it can be unit-tested without Supabase.
 */

import { RATING_RULES, type RatingRules } from "@/features/rankings/ratingConfig";

/** Aliases of the rules config, kept for existing importers. */
export const RATING_MIN = RATING_RULES.min;
export const RATING_MAX = RATING_RULES.max;
/** Starting rating for every player (Beginner). */
export const STARTING_RATING = RATING_RULES.start;

export interface RatedPlayer {
  id: string;
  rating: number;
  gamesPlayed: number;
}

export interface RatingChange {
  playerId: string;
  oldRating: number;
  newRating: number;
  change: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, rules: RatingRules) => Math.min(rules.max, Math.max(rules.min, n));

/** How much faster a player with this many games moves; 1 once established. */
export function kMultiplier(gamesPlayed: number, rules: RatingRules = RATING_RULES): number {
  const step = rules.newPlayerSchedule.find((s) => gamesPlayed < s.beforeGames);
  return step ? step.multiplier : 1;
}

function teamRating(team: RatedPlayer[], rules: RatingRules): number {
  return team.reduce((sum, p) => sum + (Number(p.rating) || rules.start), 0) / Math.max(1, team.length);
}

/** Probability that team A beats team B. */
export function expectedScore(ratingA: number, ratingB: number, rules: RatingRules = RATING_RULES): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / rules.scale));
}

/**
 * Rating changes for one finished ranked game.
 * @param scoreA / scoreB final score (a win/loss-only game is 1-0 and gets no margin bonus)
 * @param targetPoints points needed to win, used to size the margin bonus
 */
export function calculateRatingChanges(
  teamA: RatedPlayer[],
  teamB: RatedPlayer[],
  scoreA: number,
  scoreB: number,
  targetPoints: number,
  rules: RatingRules = RATING_RULES
): RatingChange[] {
  if (teamA.length === 0 || teamB.length === 0 || scoreA === scoreB) return [];

  const aWon = scoreA > scoreB;
  const expectedA = expectedScore(teamRating(teamA, rules), teamRating(teamB, rules), rules);

  const margin = Math.abs(scoreA - scoreB);
  const isResultOnly = Math.max(scoreA, scoreB) === 1;
  const marginRatio = isResultOnly ? 0 : Math.min(1, margin / Math.max(1, targetPoints));
  const k = rules.baseK * (1 + rules.maxMarginBonus * marginRatio);

  const deltaA = k * ((aWon ? 1 : 0) - expectedA);

  const change = (p: RatedPlayer, delta: number): RatingChange => {
    const oldRating = round2(Number(p.rating) || rules.start);
    const newRating = round2(clamp(oldRating + delta * kMultiplier(p.gamesPlayed, rules), rules));
    return { playerId: p.id, oldRating, newRating, change: round2(newRating - oldRating) };
  };

  return [...teamA.map((p) => change(p, deltaA)), ...teamB.map((p) => change(p, -deltaA))];
}

/**
 * What changes when a saved ranked game is corrected. Ratings are recomputed from
 * each player's rating before the game (`rating`); `delta` is what to add to their
 * current rating. Later games are not replayed.
 */
export function correctionDeltas(
  teamA: RatedPlayer[],
  teamB: RatedPlayer[],
  newScoreA: number,
  newScoreB: number,
  targetPoints: number,
  oldChanges: Record<string, number>,
  rules: RatingRules = RATING_RULES
): { playerId: string; newChange: number; delta: number }[] {
  return calculateRatingChanges(teamA, teamB, newScoreA, newScoreB, targetPoints, rules).map((c) => ({
    playerId: c.playerId,
    newChange: c.change,
    delta: round2(c.change - (oldChanges[c.playerId] ?? 0)),
  }));
}
