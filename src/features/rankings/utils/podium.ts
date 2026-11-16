import type { RankedPlayer } from "./leaderboard";

/** The three podium places: the first three qualified players, padded with `null` for open spots. */
export function podiumSlots(players: RankedPlayer[]): (RankedPlayer | null)[] {
  const top: (RankedPlayer | null)[] = players.filter((p) => p.qualified).slice(0, 3);
  while (top.length < 3) top.push(null);
  return top;
}
