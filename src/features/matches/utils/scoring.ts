export interface ScoringRule {
  /** Points needed to win (11 standard, 6 speed play). */
  targetPoints: number;
  /** true: must lead by 2 (10-10 goes to 12-10). false: first to target wins (10-10 → 11-10). */
  winByTwo: boolean;
  /** false: win/loss only. The winner is recorded as 1-0 and no points are kept. */
  trackScores?: boolean;
}

export type ScoringTeam = "A" | "B";

/** The score saved for a win/loss-only game. */
export function resultOnlyScore(team: ScoringTeam): { scoreA: number; scoreB: number } {
  return team === "A" ? { scoreA: 1, scoreB: 0 } : { scoreA: 0, scoreB: 1 };
}

/**
 * True for a game recorded as win/loss only. A 1-0 score can't come from a real
 * points game (the lowest target is 6), so it marks a win/loss result.
 */
export function isResultOnlyScore(scoreA?: number | null, scoreB?: number | null): boolean {
  const a = Number(scoreA ?? 0);
  const b = Number(scoreB ?? 0);
  return (a === 1 && b === 0) || (a === 0 && b === 1);
}

/** "11 - 9" for points games, "W - L" / "L - W" for win/loss-only games. */
export function formatMatchScore(scoreA?: number | null, scoreB?: number | null): string {
  const a = Number(scoreA ?? 0);
  const b = Number(scoreB ?? 0);
  if (isResultOnlyScore(a, b)) return a > b ? "W - L" : "L - W";
  return `${a} - ${b}`;
}

export function getWinMargin(rule: ScoringRule): number {
  return rule.winByTwo ? 2 : 1;
}

/** The winning team if the score is a finished game under this rule, else null. */
export function getWinner(scoreA: number, scoreB: number, rule: ScoringRule): ScoringTeam | null {
  if (rule.trackScores === false) {
    if (scoreA === 1 && scoreB === 0) return "A";
    if (scoreA === 0 && scoreB === 1) return "B";
    return null;
  }
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
  if (rule.trackScores === false) return resultOnlyScore(team);

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

/** Short label such as "to 11, win by 2", "first to 11" or "win/loss only". */
export function describeRule(rule: ScoringRule): string {
  if (rule.trackScores === false) return "win/loss only";
  return rule.winByTwo ? `to ${rule.targetPoints}, win by 2` : `first to ${rule.targetPoints}`;
}
