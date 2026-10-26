import { seededRandom } from "./scoring";
import type { Decision, LineEntry, MatchingStyle, MatchmakingInput, PastGame, Teams } from "./types";

export const e = (id: string, rating: number | null = 3, pairId?: string): LineEntry => ({ playerId: id, rating, pairId });

/** p1..pn, all at rating 3. */
export const ids = (n: number): LineEntry[] => Array.from({ length: n }, (_, i) => e(`p${i + 1}`, 3));

let clock = 0;
/** A finished game; `endedAt` increases with every call. */
export function game(teamA: string[], teamB: string[], winner: "A" | "B" | null = "A", courtId = "c1"): PastGame {
  clock += 1;
  return { courtId, teamA, teamB, winner, endedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString() };
}

export function input(style: MatchingStyle, line: LineEntry[], history: PastGame[] = []): MatchmakingInput {
  return {
    style,
    line,
    history,
    court: "c1",
    courts: ["c1"],
    settings: { skillSpread: 0.75 },
    random: seededRandom("t"),
  };
}

/** Normalises team and member order so decisions compare regardless of how they were split. */
export function sorted(decision: Decision): Decision {
  if (!("teamA" in decision)) return decision;
  const teams = [[...decision.teamA].sort(), [...decision.teamB].sort()].sort((a, b) => a[0].localeCompare(b[0]));
  return { teamA: teams[0], teamB: teams[1] } as Teams;
}
