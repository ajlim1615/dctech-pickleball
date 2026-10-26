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
    let latest: PastGame | undefined;
    for (const g of history) {
      if (g.courtId !== courtId || !g.winner) continue;
      if (!latest || g.endedAt > latest.endedAt) latest = g;
    }
    if (!latest) return;
    const winners = latest.winner === "A" ? latest.teamA : latest.teamB;
    if (winners.length !== 2 || !winners.every((id) => waiting.has(id))) return;
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
