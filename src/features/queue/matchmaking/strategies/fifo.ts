import { enumerateOptions, pickCheapest, shortfall } from "../scoring";
import type { Decision } from "../types";
import type { Strategy } from "../index";

/** Fewest skips, then line order: #1+#2 vs #3+#4 unless a locked pair says otherwise. */
export const fifo: Strategy = (_input, ctx) => {
  const best = pickCheapest(enumerateOptions(ctx.window, true), (o) => o.skips, "line");
  return (best ? best.teams : { hold: "not_enough_players", needed: shortfall(ctx.window.length, 4) }) as Decision;
};
