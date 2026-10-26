import { kingQueenPlacements } from "../history";
import { buildCtx, buildWindow, pickCheapest, shortfall } from "../scoring";
import type { Decision, LineEntry, MatchmakingInput } from "../types";
import { balanced, balancedCost } from "./balanced";
import type { Option } from "../scoring";

/**
 * Winners of the court below move up, Court 1 winners stay. Placed pairs bypass the shared
 * four-player hold: two placed pairs need nobody from the line, one needs two.
 */
export function kingQueen(input: MatchmakingInput): Decision {
  const placements = kingQueenPlacements(input.history, input.line, input.courts);
  const placed = new Set<string>();
  for (const p of placements.values()) {
    p.staying?.forEach((id) => placed.add(id));
    p.promoted?.forEach((id) => placed.add(id));
  }
  const window = buildWindow(input.line.filter((x) => !placed.has(x.playerId)));
  const ctx = buildCtx(input, window);

  const mine = placements.get(input.court) ?? {};
  const isFirst = input.courts[0] === input.court;
  const sides = (isFirst ? [mine.staying, mine.promoted] : [mine.promoted]).filter(
    (s): s is [string, string] => s !== undefined
  );

  if (sides.length === 2) return { teamA: sides[0], teamB: sides[1] };
  if (sides.length === 0) {
    if (window.length < 4) return { hold: "not_enough_players", needed: shortfall(window.length, 4) };
    return balanced(input, ctx);
  }

  const side = sides[0];
  if (window.length < 2) return { hold: "not_enough_players", needed: shortfall(window.length, 2) };
  const first = window[0];
  const inWindow = (x: LineEntry) =>
    x.pairId ? window.find((o) => o.pairId === x.pairId && o.playerId !== x.playerId) : undefined;
  const firstPartner = inWindow(first);
  const candidates = firstPartner
    ? [firstPartner]
    : window.slice(1, 6).filter((x) => !inWindow(x));
  // Players are present but none can legally partner: a line change, not just one more player, resolves it.
  if (candidates.length === 0) return { hold: "not_enough_players", needed: 1 };
  const options: Option[] = candidates.map((partner) => ({
    four: [first, partner],
    teams: { teamA: side, teamB: [first.playerId, partner.playerId] },
    skips: window.indexOf(partner) - 1,
  }));
  const best = pickCheapest(options, (o) => balancedCost(o, ctx), "line");
  return best ? best.teams : { hold: "not_enough_players", needed: 1 };
}
