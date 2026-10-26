export type MatchingStyle =
  | "balanced"
  | "social_mixer"
  | "skill_separated"
  | "winners_losers"
  | "skill_courts"
  | "mixed_doubles"
  | "king_queen"
  | "club_wars"
  | "fifo"
  | "winners_stay";

/** One waiting player, in line order. Players sharing a `pairId` must play together. */
export interface LineEntry {
  playerId: string;
  rating: number | null;
  pairId?: string | null;
}

/** A finished (or abandoned) game, used to avoid repeats and to read win/loss streaks. */
export interface PastGame {
  courtId: string;
  teamA: string[];
  teamB: string[];
  winner: "A" | "B" | null;
  endedAt: string;
}

export interface MatchmakingInput {
  style: MatchingStyle;
  line: LineEntry[];
  history: PastGame[];
  court: string;
  courts: string[];
  settings: { skillSpread: number };
  random: () => number;
  force?: boolean;
}

export interface Teams {
  teamA: [string, string];
  teamB: [string, string];
}

export type Decision = Teams | { hold: "not_enough_players"; needed: number } | { hold: "no_skill_match" };

export const DEFAULT_RATING = 3.0;
export const DEFAULT_SKILL_SPREAD = 0.75;
export const WINDOW_SIZE = 6;
