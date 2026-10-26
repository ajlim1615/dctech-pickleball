import { pairCounts } from "./history";
import { buildWindow, ratingOf } from "./scoring";
import type { Decision, LineEntry, MatchmakingInput } from "./types";
import { balanced } from "./strategies/balanced";
import { fifo } from "./strategies/fifo";
import { socialMix } from "./strategies/socialMix";

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
  const window = buildWindow(input.line);
  if (window.length < 4) return { hold: "not_enough_players", needed: 4 - window.length };
  const ctx: StrategyCtx = {
    window,
    counts: pairCounts(input.history),
    ratings: new Map(input.line.map((x) => [x.playerId, ratingOf(x)])),
  };
  if (input.force) return balanced(input, ctx);
  switch (input.style) {
    case "social_mixer":
    case "mixed_doubles":
    case "club_wars":
      return socialMix(input, ctx);
    case "fifo":
      return fifo(input, ctx);
    default:
      // winners_losers, skill_separated, skill_courts, king_queen, winners_stay fall back to balanced until their tasks land.
      return balanced(input, ctx);
  }
}
