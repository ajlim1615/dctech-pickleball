import { decide, DEFAULT_RATING, DEFAULT_SKILL_SPREAD } from "@/features/queue/matchmaking";
import type { LineEntry, MatchingStyle, PastGame } from "@/features/queue/matchmaking";
import type { UpNextCard } from "./types";

/** Styles where the court decides who plays, so each card belongs to one court. */
export const COURT_BOUND_STYLES: MatchingStyle[] = ["king_queen"];

export type AutoCard = { teamA: string[]; teamB: string[]; targetCourtId: string | null };

/**
 * How many Auto cards to build: enough to cover `courtCount` courts after counting
 * only FULL hand-edited cards, so a half-built "+ Add match" card never pushes out an
 * existing auto card.
 */
export function autoCardCount(courtCount: number, cards: UpNextCard[]): number {
  const fullManual = cards.filter(
    (c) => !c.isAuto && c.teamA.length === c.perSide && c.teamB.length === c.perSide
  ).length;
  return Math.max(0, courtCount - fullManual);
}

/**
 * The next `count` matches from the waiting line, as the real call-up would pick them.
 * Players in `exclude` (already in a hand-edited card) are left out. Stops at the first
 * card matchmaking would hold (not enough players, no skill match).
 */
export function buildAutoCards(input: {
  style: MatchingStyle;
  line: LineEntry[];
  history: PastGame[];
  courts: string[];
  count: number;
  perSide: 1 | 2;
  exclude: Set<string>;
  settings: { skillSpread?: number };
  random: () => number;
}): AutoCard[] {
  let line = input.line.filter((entry) => !input.exclude.has(entry.playerId));
  const bound = COURT_BOUND_STYLES.includes(input.style);
  const cards: AutoCard[] = [];

  for (let i = 0; i < input.count; i++) {
    const court = input.courts.length > 0 ? input.courts[i % input.courts.length] : "";
    let teamA: string[];
    let teamB: string[];

    if (input.perSide === 1) {
      // Matchmaking only builds doubles; singles take the next two in line.
      if (line.length < 2) break;
      teamA = [line[0].playerId];
      teamB = [line[1].playerId];
    } else {
      const decision = decide({
        style: input.style,
        line,
        history: input.history,
        court,
        courts: input.courts,
        settings: { skillSpread: input.settings.skillSpread ?? DEFAULT_SKILL_SPREAD },
        random: input.random,
      });
      if (!("teamA" in decision)) break;
      teamA = [...decision.teamA];
      teamB = [...decision.teamB];
    }

    const used = new Set([...teamA, ...teamB]);
    line = line.filter((entry) => !used.has(entry.playerId));
    cards.push({ teamA, teamB, targetCourtId: bound && court ? court : null });
  }
  return cards;
}

const RATED_STYLES: MatchingStyle[] = ["balanced", "skill_separated"];

function average(values: number[]) {
  return values.length === 0 ? DEFAULT_RATING : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Who should take an open slot on a live court. Never a paired player (that would
 * split the pair). Prefers players not already in an Up Next card; rated styles pick
 * the rating that brings the two teams' averages closest, others the longest waiting.
 */
export function pickReplacement(input: {
  style: MatchingStyle;
  line: LineEntry[];
  staying: { teamA: string[]; teamB: string[] };
  missingTeam: "team_a" | "team_b";
  inCards: Set<string>;
  random: () => number;
  /** Ratings of the players staying on court (missing = default rating). */
  ratings?: Record<string, number>;
}): string | null {
  const unpaired = input.line.filter((entry) => !entry.pairId);
  const free = unpaired.filter((entry) => !input.inCards.has(entry.playerId));
  const candidates = free.length > 0 ? free : unpaired;
  if (candidates.length === 0) return null;
  if (!RATED_STYLES.includes(input.style)) return candidates[0].playerId;

  const ratingOf = (id: string) => input.ratings?.[id] ?? DEFAULT_RATING;
  const own = input.missingTeam === "team_a" ? input.staying.teamA : input.staying.teamB;
  const other = input.missingTeam === "team_a" ? input.staying.teamB : input.staying.teamA;
  const otherAverage = average(other.map(ratingOf));

  let best = candidates[0];
  let bestGap = Infinity;
  for (const entry of candidates) {
    const gap = Math.abs(average([...own.map(ratingOf), entry.rating ?? DEFAULT_RATING]) - otherAverage);
    if (gap < bestGap) {
      best = entry;
      bestGap = gap;
    }
  }
  return best.playerId;
}
