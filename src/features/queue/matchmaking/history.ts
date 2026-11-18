import type { LineEntry, PastGame } from "./types";

/** Order-independent key for a pair of players. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** How often each pair has partnered and faced each other, over all games (winner or not). */
export function pairCounts(history: PastGame[]): { partners: Map<string, number>; opponents: Map<string, number> } {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  for (const game of history) {
    const { teamA, teamB } = game;
    for (const team of [teamA, teamB]) {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) bump(partners, pairKey(team[i], team[j]));
      }
    }
    for (const a of teamA) for (const b of teamB) bump(opponents, pairKey(a, b));
  }
  return { partners, opponents };
}

/** Each player's result in their latest game that has a winner. Players with none are absent (new). */
export function lastResults(history: PastGame[]): Map<string, "won" | "lost"> {
  const results = new Map<string, "won" | "lost">();
  const latest = new Map<string, string>();
  for (const game of history) {
    if (!game.winner) continue;
    const winners = game.winner === "A" ? game.teamA : game.teamB;
    const losers = game.winner === "A" ? game.teamB : game.teamA;
    const note = (id: string, result: "won" | "lost") => {
      const seen = latest.get(id);
      if (seen !== undefined && seen > game.endedAt) return;
      latest.set(id, game.endedAt);
      results.set(id, result);
    };
    winners.forEach((id) => note(id, "won"));
    losers.forEach((id) => note(id, "lost"));
  }
  return results;
}

/** For each open court: the pair placed on it before the line is used. */
export function kingQueenPlacements(
  history: PastGame[],
  line: LineEntry[],
  courts: string[]
): Map<string, { staying?: [string, string]; promoted?: [string, string] }> {
  const placements = new Map<string, { staying?: [string, string]; promoted?: [string, string] }>();
  const waiting = new Set(line.map((x) => x.playerId));
  courts.forEach((courtId, rank) => {
    const latest = latestWinningGame(history, courtId);
    const winners = latest ? winnersOf(latest) : undefined;
    if (!latest || !winners || !winners.every((id) => waiting.has(id))) return;
    const playedSince = history.some(
      (g) => g.endedAt > latest!.endedAt && winners.some((id) => g.teamA.includes(id) || g.teamB.includes(id))
    );
    if (playedSince) return;
    const pair: [string, string] = [winners[0], winners[1]];
    if (rank === 0) placements.set(courts[0], { ...placements.get(courts[0]), staying: pair });
    else placements.set(courts[rank - 1], { ...placements.get(courts[rank - 1]), promoted: pair });
  });
  return placements;
}

/** The court's most recent game that has a winner (by `endedAt`). */
export function latestWinningGame(history: PastGame[], courtId: string): PastGame | undefined {
  let latest: PastGame | undefined;
  for (const g of history) {
    if (g.courtId !== courtId || !g.winner) continue;
    if (!latest || g.endedAt > latest.endedAt) latest = g;
  }
  return latest;
}

/** The winning pair of a game that has a winner, or undefined for an abandoned or malformed game. */
export function winnersOf(game: PastGame): [string, string] | undefined {
  const team = game.winner === "A" ? game.teamA : game.winner === "B" ? game.teamB : undefined;
  return team && team.length === 2 ? [team[0], team[1]] : undefined;
}

const MAX_GAMES_AHEAD = 1.5;

function toEpochMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Number of completed games played per player in `history`. */
export function gamesPlayedCounts(history: PastGame[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const game of history) {
    for (const id of game.teamA) bump(counts, id);
    for (const id of game.teamB) bump(counts, id);
  }
  return counts;
}

/**
 * Signed game-count delta relative to window peers, normalized for arrival time.
 * Positive = ahead of peers (played more than expected); negative = behind peers.
 * Brand-new arrivals (0 eligible games) are neutral (0) and excluded from `avgShare`.
 */
export function gamesAheadByPlayer(window: LineEntry[], history: PastGame[]): Map<string, number> {
  const ahead = new Map<string, number>();
  if (window.length === 0) return ahead;

  const counts = gamesPlayedCounts(history);
  const earliestGameEndMs = new Map<string, number>();
  const gameEndTimes: (number | null)[] = [];

  for (const game of history) {
    const endMs = toEpochMs(game.endedAt);
    gameEndTimes.push(endMs);
    if (endMs === null) continue;
    for (const id of [...game.teamA, ...game.teamB]) {
      const prev = earliestGameEndMs.get(id);
      if (prev === undefined || endMs < prev) earliestGameEndMs.set(id, endMs);
    }
  }

  const stats: { playerId: string; played: number; eligible: number }[] = [];

  for (const entry of window) {
    const played = counts.get(entry.playerId) ?? 0;
    const arrivedMs = toEpochMs(entry.arrivedAt);
    const firstEndMs = earliestGameEndMs.get(entry.playerId);

    let effectiveArrivedMs: number | null;
    if (arrivedMs !== null && firstEndMs !== undefined) {
      effectiveArrivedMs = Math.min(arrivedMs, firstEndMs);
    } else if (arrivedMs !== null) {
      effectiveArrivedMs = arrivedMs;
    } else {
      effectiveArrivedMs = null;
    }

    let eligibleRaw: number;
    if (effectiveArrivedMs === null) {
      eligibleRaw = history.length;
    } else {
      eligibleRaw = 0;
      for (const endMs of gameEndTimes) {
        if (endMs !== null && endMs >= effectiveArrivedMs) eligibleRaw += 1;
      }
    }

    const eligible = Math.max(eligibleRaw, played);
    if (eligible === 0) {
      ahead.set(entry.playerId, 0);
    } else {
      stats.push({ playerId: entry.playerId, played, eligible });
    }
  }

  if (stats.length === 0) return ahead;

  const avgShare = stats.reduce((sum, s) => sum + s.played / s.eligible, 0) / stats.length;
  for (const s of stats) {
    const raw = s.played - avgShare * s.eligible;
    ahead.set(s.playerId, Math.max(-MAX_GAMES_AHEAD, Math.min(MAX_GAMES_AHEAD, raw)));
  }
  return ahead;
}
