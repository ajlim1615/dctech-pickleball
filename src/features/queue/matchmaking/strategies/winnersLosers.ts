import { lastResults } from "../history";
import { enumerateOptions, pickCheapest, shortfall, type Option } from "../scoring";
import type { Decision } from "../types";
import type { Strategy } from "../index";
import { balancedCost } from "./balanced";

export const MIXED_RESULTS_WEIGHT = 10;

/** 4 minus the larger group of same-result players; players with no result yet count as either. */
export function mixedResults(four: Option["four"], results: Map<string, "won" | "lost">): number {
  const count = (r: "won" | "lost") =>
    four.filter((x) => {
      const last = results.get(x.playerId);
      return last === undefined || last === r;
    }).length;
  return 4 - Math.max(count("won"), count("lost"));
}

/** Groups winners with winners and losers with losers; never holds beyond not-enough-players. */
export const winnersLosers: Strategy = (input, ctx) => {
  const results = lastResults(input.history);
  const best = pickCheapest(
    enumerateOptions(ctx.window, true),
    (o) => MIXED_RESULTS_WEIGHT * mixedResults(o.four, results) + balancedCost(o, ctx),
    "line"
  );
  return (best ? best.teams : { hold: "not_enough_players", needed: shortfall(ctx.window.length, 4) }) as Decision;
};
