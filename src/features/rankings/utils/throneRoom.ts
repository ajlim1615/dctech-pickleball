import type { RankedPlayer } from "./leaderboard";

/** How the single ruler was picked when players were level at the top. */
export type ThroneTieBreak = null | "games" | "name";

export interface ThroneRoom {
  /** The one player on the throne; null when no one is ranked yet. */
  ruler: RankedPlayer | null;
  /** The two knights beside the throne: #2 on the left, #3 on the right. */
  guards: { left: RankedPlayer | null; right: RankedPlayer | null };
  /** Everyone kneeling after them, best first (front row first). */
  kneeling: RankedPlayer[];
  /** Set when the top was a tie and an extra rule picked the ruler. */
  tieBrokenBy: ThroneTieBreak;
}

/** Kneeling spots in the scene: 2 in front, 4 in the middle, 6 at the back. */
export const THRONE_KNEELERS = 12;

const nameOf = (p: RankedPlayer) => (p.full_name || p.display_name || "").toLowerCase();

/**
 * The throne room meme: the #1 ranked player sits alone on the throne, the next two
 * stand guard as its knights, and the players after them kneel. Rankings let players
 * share #1; the throne can't, so a tie at the top goes to more games played, then
 * name A-Z. The same order decides who guards and who kneels.
 */
export function throneRoom(players: RankedPlayer[], kneelers = THRONE_KNEELERS): ThroneRoom {
  const ranked = players
    .filter((p) => p.rank !== null)
    .sort(
      (a, b) =>
        (a.rank ?? 0) - (b.rank ?? 0) ||
        b.games_played - a.games_played ||
        nameOf(a).localeCompare(nameOf(b))
    );
  if (ranked.length === 0) {
    return { ruler: null, guards: { left: null, right: null }, kneeling: [], tieBrokenBy: null };
  }

  const [ruler, left = null, right = null, ...rest] = ranked;
  let tieBrokenBy: ThroneTieBreak = null;
  if (left && left.rank === ruler.rank) {
    tieBrokenBy = left.games_played !== ruler.games_played ? "games" : "name";
  }
  return { ruler, guards: { left, right }, kneeling: rest.slice(0, kneelers), tieBrokenBy };
}
