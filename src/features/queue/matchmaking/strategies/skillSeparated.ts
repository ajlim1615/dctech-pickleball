import { enumerateOptions, pickCheapest, ratingOf, type Option } from "../scoring";
import type { Strategy } from "../index";
import { balancedCost } from "./balanced";

/** Holds with no_skill_match unless some four sits within `settings.skillSpread` of each other. */
export const skillSeparated: Strategy = (input, ctx) => {
  const valid = (o: Option) => {
    const rs = o.four.map(ratingOf);
    return Math.max(...rs) - Math.min(...rs) <= input.settings.skillSpread + 1e-9;
  };
  const cost = (o: Option) => balancedCost(o, ctx);
  const first = pickCheapest(enumerateOptions(ctx.window, true).filter(valid), cost, "line");
  if (first) return first.teams;
  const other = pickCheapest(enumerateOptions(ctx.window, false).filter(valid), cost, "line");
  return other ? other.teams : { hold: "no_skill_match" };
};
