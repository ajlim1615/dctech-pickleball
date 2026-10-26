import type { pairCounts } from "./history";
import { buildCtx, buildWindow, shortfall } from "./scoring";
import type { Decision, LineEntry, MatchmakingInput } from "./types";
import { balanced } from "./strategies/balanced";
import { fifo } from "./strategies/fifo";
import { kingQueen } from "./strategies/kingQueen";
import { skillSeparated } from "./strategies/skillSeparated";
import { socialMix } from "./strategies/socialMix";
import { winnersLosers } from "./strategies/winnersLosers";
import { winnersStay } from "./strategies/winnersStay";

export * from "./types";
export { seededRandom, teamStats } from "./scoring";
export { DEFAULT_SKILL_SPREAD } from "./types";

export interface StrategyCtx {
  window: LineEntry[];
  counts: ReturnType<typeof pairCounts>;
  ratings: Map<string, number>;
}

export type Strategy = (input: MatchmakingInput, ctx: StrategyCtx) => Decision;

/** Decide who plays next on `input.court`, or why nobody can yet. Pure: same input, same answer. */
export function decide(input: MatchmakingInput): Decision {
  // King/Queen places pairs before the line is used, so it bypasses the shared four-player hold.
  if (input.style === "king_queen" && !input.force) return kingQueen(input);

  const window = buildWindow(input.line);
  if (window.length < 4) return { hold: "not_enough_players", needed: shortfall(window.length, 4) };
  const ctx = buildCtx(input, window);
  if (input.force) return balanced(input, ctx);
  switch (input.style) {
    case "balanced":
      return balanced(input, ctx);
    case "social_mixer":
    case "mixed_doubles":
    case "club_wars":
      return socialMix(input, ctx);
    case "fifo":
      return fifo(input, ctx);
    case "winners_losers":
      return winnersLosers(input, ctx);
    case "skill_separated":
    case "skill_courts":
      return skillSeparated(input, ctx);
    case "winners_stay":
      return winnersStay(input, ctx);
    case "king_queen":
      return kingQueen(input);
    default: {
      const unreachable: never = input.style;
      throw new Error(`Unhandled matching style: ${String(unreachable)}`);
    }
  }
}
