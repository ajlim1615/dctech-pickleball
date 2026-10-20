/**
 * Rating updates for ranked games, on the app's 1.0–6.0 (DUPR-style) scale.
 *
 * Elo-style: each team's strength is its players' average rating, the expected
 * result comes from the rating gap, and every player moves by
 * K × (actual − expected). Pure so it can be unit-tested without Supabase.
 */

export const RATING_MIN = 1.0;
export const RATING_MAX = 6.0;

/** Base change for a single game between evenly matched teams. */
const BASE_K = 0.1;
/** Rating gap that makes the stronger team ~91% favourite (Elo's 400 points, rescaled). */
const SCALE = 1.0;
/** Players with fewer games than this move faster until their rating settles. */
const PROVISIONAL_GAMES = 10;
const PROVISIONAL_MULTIPLIER = 1.5;
/** A blowout adds at most this much on top of the base change. */
const MAX_MARGIN_BONUS = 0.5;

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
const clamp = (n: number) => Math.min(RATING_MAX, Math.max(RATING_MIN, n));

function teamRating(team: RatedPlayer[]): number {
  return team.reduce((sum, p) => sum + (Number(p.rating) || 3.0), 0) / Math.max(1, team.length);
}

/** Probability that team A beats team B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / SCALE));
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
  targetPoints: number
): RatingChange[] {
  if (teamA.length === 0 || teamB.length === 0 || scoreA === scoreB) return [];

  const aWon = scoreA > scoreB;
  const expectedA = expectedScore(teamRating(teamA), teamRating(teamB));

  const margin = Math.abs(scoreA - scoreB);
  const isResultOnly = Math.max(scoreA, scoreB) === 1;
  const marginRatio = isResultOnly ? 0 : Math.min(1, margin / Math.max(1, targetPoints));
  const k = BASE_K * (1 + MAX_MARGIN_BONUS * marginRatio);

  const deltaA = k * ((aWon ? 1 : 0) - expectedA);

  const change = (p: RatedPlayer, delta: number): RatingChange => {
    const oldRating = round2(Number(p.rating) || 3.0);
    const playerK = p.gamesPlayed < PROVISIONAL_GAMES ? PROVISIONAL_MULTIPLIER : 1;
    const newRating = round2(clamp(oldRating + delta * playerK));
    return { playerId: p.id, oldRating, newRating, change: round2(newRating - oldRating) };
  };

  return [...teamA.map((p) => change(p, deltaA)), ...teamB.map((p) => change(p, -deltaA))];
}
