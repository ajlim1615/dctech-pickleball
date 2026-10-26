import { pairCounts, pairKey } from "./history";
import type { StrategyCtx } from "./index";
import { DEFAULT_RATING, WINDOW_SIZE, type LineEntry, type MatchmakingInput, type Teams } from "./types";

/** The partner of `entry` if they are waiting in `line`, otherwise undefined (treated as solo). */
function partnerIn(entry: LineEntry, line: LineEntry[]): LineEntry | undefined {
  if (!entry.pairId) return undefined;
  return line.find((o) => o.pairId === entry.pairId && o.playerId !== entry.playerId);
}

/**
 * The first WINDOW_SIZE players, plus the first-in-line's partner appended if they sit further
 * down. A window member whose partner waits outside the window is dropped (no back-fill).
 */
export function buildWindow(line: LineEntry[]): LineEntry[] {
  const window = line.slice(0, WINDOW_SIZE);
  const extra = line.length > 0 ? partnerIn(line[0], line) : undefined;
  const appended = extra && !window.includes(extra) ? extra : undefined;
  const inWindow = new Set(window.map((x) => x.playerId));
  if (appended) inWindow.add(appended.playerId);
  const kept = window.filter((x) => {
    const partner = partnerIn(x, line);
    return !partner || inWindow.has(partner.playerId);
  });
  return appended ? [...kept, appended] : kept;
}

export interface Option {
  four: LineEntry[];
  teams: Teams;
  skips: number;
}

/**
 * Every 4-set of the window (containing window[0] when `requireFirst`) times its three splits,
 * dropping sets with half a pair and splits that put a pair on opposite teams.
 */
export function enumerateOptions(window: LineEntry[], requireFirst: boolean): Option[] {
  const options: Option[] = [];
  const n = window.length;
  for (let a = 0; a < n; a++) {
    if (requireFirst && a !== 0) break;
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          const four = [window[a], window[b], window[c], window[d]];
          const ids = new Set(four.map((x) => x.playerId));
          const halfPair = four.some((x) => {
            const partner = partnerIn(x, window);
            return partner && !ids.has(partner.playerId);
          });
          if (halfPair) continue;
          const skips = a + b + c + d - 6;
          const [p0, p1, p2, p3] = four;
          const splits: [LineEntry[], LineEntry[]][] = [
            [[p0, p1], [p2, p3]],
            [[p0, p2], [p1, p3]],
            [[p0, p3], [p1, p2]],
          ];
          for (const [ta, tb] of splits) {
            const teamIds = new Set(ta.map((x) => x.playerId));
            const apart = four.some((x) => {
              const partner = partnerIn(x, window);
              return partner && teamIds.has(x.playerId) !== teamIds.has(partner.playerId);
            });
            if (apart) continue;
            options.push({
              four,
              teams: {
                teamA: [ta[0].playerId, ta[1].playerId],
                teamB: [tb[0].playerId, tb[1].playerId],
              },
              skips,
            });
          }
        }
      }
    }
  }
  return options;
}

export function ratingOf(e: LineEntry): number {
  return e.rating ?? DEFAULT_RATING;
}

/** Absolute difference between the two teams' average ratings. */
export function ratingGap(teams: Teams, ratings: Map<string, number>): number {
  const avg = (ids: string[]) => ids.reduce((sum, id) => sum + (ratings.get(id) ?? DEFAULT_RATING), 0) / ids.length;
  return Math.abs(avg(teams.teamA) - avg(teams.teamB));
}

/** How many partnerships and oppositions in these teams have happened before. */
export function repeatCounts(
  teams: Teams,
  counts: ReturnType<typeof pairCounts>
): { partnerRepeats: number; opponentRepeats: number } {
  let partnerRepeats = 0;
  let opponentRepeats = 0;
  for (const team of [teams.teamA, teams.teamB]) {
    partnerRepeats += counts.partners.get(pairKey(team[0], team[1])) ?? 0;
  }
  for (const a of teams.teamA) {
    for (const b of teams.teamB) opponentRepeats += counts.opponents.get(pairKey(a, b)) ?? 0;
  }
  return { partnerRepeats, opponentRepeats };
}

/**
 * The lowest-cost option. "line" keeps the earliest among equal costs; a random function picks
 * uniformly among them. Costs within 1e-9 count as equal.
 */
export function pickCheapest(
  options: Option[],
  cost: (o: Option) => number,
  tieBreak: "line" | (() => number)
): Option | null {
  if (options.length === 0) return null;
  const costs = options.map(cost);
  const min = Math.min(...costs);
  const best = options.filter((_, i) => costs[i] - min <= 1e-9);
  if (tieBreak === "line") return best[0];
  return best[Math.min(best.length - 1, Math.floor(tieBreak() * best.length))];
}

/** Team averages and balance score; same rounding and formula as the legacy createMatchupFromPod. */
export function teamStats(
  teams: { teamA: string[]; teamB: string[] },
  ratingOf: (id: string) => number
): { teamARatingAvg: number; teamBRatingAvg: number; ratingDelta: number; balanceScorePercent: number } {
  const avg = (ids: string[]) =>
    ids.length > 0 ? Number((ids.reduce((sum, id) => sum + ratingOf(id), 0) / ids.length).toFixed(2)) : 0;
  const teamARatingAvg = avg(teams.teamA);
  const teamBRatingAvg = avg(teams.teamB);
  const ratingDelta = Number(Math.abs(teamARatingAvg - teamBRatingAvg).toFixed(2));
  const balanceScorePercent = Math.max(10, Math.min(100, Math.round(100 - ratingDelta * 40)));
  return { teamARatingAvg, teamBRatingAvg, ratingDelta, balanceScorePercent };
}

/**
 * Deterministic PRNG (FNV-1a hash of the seed feeding mulberry32). The same seed always
 * yields the same sequence, so a preview rendered on the server matches the client.
 */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Players still missing from a window of `have` to reach `want`; never below 1 for a hold. */
export function shortfall(have: number, want: number): number {
  return Math.max(1, want - have);
}

/** The shared strategy context for a window built from `input.line`. */
export function buildCtx(input: MatchmakingInput, window: LineEntry[]): StrategyCtx {
  return {
    window,
    counts: pairCounts(input.history),
    ratings: new Map(input.line.map((x) => [x.playerId, ratingOf(x)])),
  };
}
