import { enumerateOptions, pickCheapest, ratingGap, ratingOf } from "../scoring";
import type { Decision, MatchmakingInput } from "../types";
import type { StrategyCtx } from "../index";

/** Legacy: the court's winners stay if both wait, facing the next two in line. */
export function winnersStay(input: MatchmakingInput, ctx: StrategyCtx): Decision {
  let latest: MatchmakingInput["history"][number] | undefined;
  for (const g of input.history) {
    if (g.courtId !== input.court || !g.winner) continue;
    if (!latest || g.endedAt > latest.endedAt) latest = g;
  }
  const winners = latest ? (latest.winner === "A" ? latest.teamA : latest.teamB) : [];
  const waiting = new Set(input.line.map((x) => x.playerId));

  if (latest && winners.length === 2 && winners.every((id) => waiting.has(id))) {
    const [w1, w2] = winners;
    const others = input.line.filter((x) => x.playerId !== w1 && x.playerId !== w2);
    if (others.length < 2) return { hold: "not_enough_players", needed: 2 - others.length };
    const [c1, c2] = others;
    const rating = (id: string) => ctx.ratings.get(id) ?? 0;
    const weaker = ratingOf(c2) <= ratingOf(c1) ? c2 : c1;
    const stronger = weaker === c2 ? c1 : c2;
    return rating(w1) >= rating(w2)
      ? { teamA: [w1, weaker.playerId], teamB: [w2, stronger.playerId] }
      : { teamA: [w2, weaker.playerId], teamB: [w1, stronger.playerId] };
  }

  // First four by skips, split strongest + weakest vs middle two; history ignored.
  const best = pickCheapest(
    enumerateOptions(ctx.window, true),
    (o) => 100 * o.skips + ratingGap(o.teams, ctx.ratings),
    "line"
  );
  return best ? best.teams : { hold: "not_enough_players", needed: 4 - ctx.window.length };
}
