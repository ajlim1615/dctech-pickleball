import { describeRule, getWinner, type ScoringRule } from "@/features/matches/utils/scoring";
import { correctionDeltas, type RatedPlayer } from "@/features/rankings/utils/ratingEngine";

export interface ResultCorrectionInput {
  rule: ScoringRule;
  isRanked: boolean;
  oldScore: { a: number; b: number };
  newScore: { a: number; b: number };
  teamA: RatedPlayer[];
  teamB: RatedPlayer[];
  /** This game's rating-history rows: each player's rating before it and the change it applied. */
  history: { playerId: string; oldRating: number; change: number }[];
}

export interface ResultCorrectionPlan {
  error?: string;
  /** The new score is the stored score: nothing to write. */
  unchanged?: boolean;
  winningTeam?: "team_a" | "team_b";
  ratingUpdates: { playerId: string; delta: number; newChange: number }[];
  winsMoves: { playerId: string; by: 1 | -1 }[];
}

/**
 * Works out what correcting a saved game changes. Pure, so the server action only
 * has to load the rows and write the result.
 */
export function planResultCorrection(input: ResultCorrectionInput): ResultCorrectionPlan {
  const { rule, isRanked, oldScore, newScore, teamA, teamB, history } = input;
  const newWinner = getWinner(newScore.a, newScore.b, rule);
  if (!newWinner) {
    return {
      error: `${newScore.a}-${newScore.b} is not a finished game. This session plays ${describeRule(rule)}.`,
      ratingUpdates: [],
      winsMoves: [],
    };
  }
  const winningTeam = newWinner === "A" ? "team_a" : "team_b";
  if (newScore.a === oldScore.a && newScore.b === oldScore.b) {
    return { unchanged: true, winningTeam, ratingUpdates: [], winsMoves: [] };
  }
  if (!isRanked) return { winningTeam, ratingUpdates: [], winsMoves: [] };

  // Ratings: recompute from each player's rating before this game. Games saved before
  // ratings existed have no history rows, so their ratings are left alone.
  let ratingUpdates: ResultCorrectionPlan["ratingUpdates"] = [];
  if (history.length > 0) {
    const before = new Map(history.map((h) => [h.playerId, h.oldRating]));
    const withBefore = (team: RatedPlayer[]) =>
      team.map((p) => ({ ...p, rating: before.get(p.id) ?? p.rating }));
    const oldChanges = Object.fromEntries(history.map((h) => [h.playerId, h.change]));
    ratingUpdates = correctionDeltas(withBefore(teamA), withBefore(teamB), newScore.a, newScore.b, rule.targetPoints, oldChanges);
  }

  // Wins only move when the winner flips.
  const oldWinnerIsA = oldScore.a > oldScore.b;
  const winsMoves: ResultCorrectionPlan["winsMoves"] =
    oldWinnerIsA === (newWinner === "A")
      ? []
      : [
          ...(oldWinnerIsA ? teamA : teamB).map((p) => ({ playerId: p.id, by: -1 as const })),
          ...(oldWinnerIsA ? teamB : teamA).map((p) => ({ playerId: p.id, by: 1 as const })),
        ];

  return { winningTeam, ratingUpdates, winsMoves };
}

/**
 * How many ranked games a player had before a given game: today's total minus the
 * games recorded after it, minus the game itself. Rates provisional players correctly.
 */
export function gamesPlayedBefore(currentGamesPlayed: number, gamesAfter: number): number {
  return Math.max(0, currentGamesPlayed - gamesAfter - 1);
}
