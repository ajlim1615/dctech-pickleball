import { enumerateOptions, pickCheapest, ratingGap, repeatCounts, shortfall, type Option } from "../scoring";
import type { Decision } from "../types";
import type { Strategy, StrategyCtx } from "../index";

export const RATING_GAP_WEIGHT = 10;
export const PARTNER_REPEAT_WEIGHT = 3;
export const OPPONENT_REPEAT_WEIGHT = 1;
export const SKIP_WEIGHT = 0.5;

/** 10·ratingGap + 3·partnerRepeats + 1·opponentRepeats + 0.5·skips */
export function balancedCost(o: Option, ctx: StrategyCtx): number {
  const { partnerRepeats, opponentRepeats } = repeatCounts(o.teams, ctx.counts);
  return (
    RATING_GAP_WEIGHT * ratingGap(o.teams, ctx.ratings) +
    PARTNER_REPEAT_WEIGHT * partnerRepeats +
    OPPONENT_REPEAT_WEIGHT * opponentRepeats +
    SKIP_WEIGHT * o.skips
  );
}

/**
 * The cheapest option that includes the first in line; ties go to the earliest in line order.
 * When no legal option exists (for example locked pairs that cannot form a team), `needed` is at
 * least 1 even though the window may be full: a change to the line, not just one more player, resolves it.
 */
export const balanced: Strategy = (_input, ctx) => {
  const best = pickCheapest(enumerateOptions(ctx.window, true), (o) => balancedCost(o, ctx), "line");
  return (best ? best.teams : { hold: "not_enough_players", needed: shortfall(ctx.window.length, 4) }) as Decision;
};
