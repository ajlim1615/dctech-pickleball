import { enumerateOptions, pickCheapest, repeatCounts, shortfall, type Option } from "../scoring";
import type { Decision } from "../types";
import type { Strategy } from "../index";
import { OPPONENT_REPEAT_WEIGHT, PARTNER_REPEAT_WEIGHT, SKIP_WEIGHT } from "./balanced";

/** Ratings ignored: 3·partnerRepeats + 1·opponentRepeats + 0.5·skips, ties broken at random. */
export const socialMix: Strategy = (input, ctx) => {
  const cost = (o: Option) => {
    const { partnerRepeats, opponentRepeats } = repeatCounts(o.teams, ctx.counts);
    return PARTNER_REPEAT_WEIGHT * partnerRepeats + OPPONENT_REPEAT_WEIGHT * opponentRepeats + SKIP_WEIGHT * o.skips;
  };
  const best = pickCheapest(enumerateOptions(ctx.window, true), cost, input.random);
  return (best ? best.teams : { hold: "not_enough_players", needed: shortfall(ctx.window.length, 4) }) as Decision;
};
