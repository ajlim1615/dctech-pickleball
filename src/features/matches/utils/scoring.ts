export interface ScoringRule {
  /** Points needed to win (11 standard, 6 speed play). */
  targetPoints: number;
  /** true: must lead by 2 (10-10 goes to 12-10). false: first to target wins (10-10 → 11-10). */
  winByTwo: boolean;
}

export type ScoringTeam = "A" | "B";

export function getWinMargin(rule: ScoringRule): number {
  return rule.winByTwo ? 2 : 1;
}

/** The winning team if the score is a finished game under this rule, else null. */
export function getWinner(scoreA: number, scoreB: number, rule: ScoringRule): ScoringTeam | null {
  const margin = getWinMargin(rule);
  if (rule.winByTwo) {
    if (scoreA >= rule.targetPoints && scoreA - scoreB >= margin) return "A";
    if (scoreB >= rule.targetPoints && scoreB - scoreA >= margin) return "B";
    return null;
  }
  // First to target: the game ends exactly at the target, so nobody can go past it.
  if (scoreA === rule.targetPoints && scoreB < rule.targetPoints) return "A";
  if (scoreB === rule.targetPoints && scoreA < rule.targetPoints) return "B";
  return null;
}

/**
 * The smallest valid final score that gives `team` the win from the current score.
 * Win by 2: 10-10 → 12-10, 5-9 → 11-9. First to target: 10-10 → 11-10, never past the target.
 */
export function quickWinScore(
  team: ScoringTeam,
  scoreA: number,
  scoreB: number,
  rule: ScoringRule
): { scoreA: number; scoreB: number } {
  const loser = team === "A" ? scoreB : scoreA;
  let winnerScore: number;
  let loserScore: number;

  if (rule.winByTwo) {
    loserScore = loser;
    winnerScore = Math.max(rule.targetPoints, loser + 2);
  } else {
    loserScore = Math.min(loser, rule.targetPoints - 1);
    winnerScore = rule.targetPoints;
  }

  return team === "A"
    ? { scoreA: winnerScore, scoreB: loserScore }
    : { scoreA: loserScore, scoreB: winnerScore };
}

/** Short label such as "to 11, win by 2" or "first to 11". */
export function describeRule(rule: ScoringRule): string {
  return rule.winByTwo ? `to ${rule.targetPoints}, win by 2` : `first to ${rule.targetPoints}`;
}
