import type { MatchingStyle } from "@/features/queue/matchmaking";

export type { MatchingStyle };

export interface DeskPlayer {
  id: string;
  name: string;
  /** DUPR-style 2.0–5.0 in 0.5 steps. */
  skill: number;
  note?: string;
  archived: boolean;
  createdAt: string;
}

export interface DeskCourt {
  id: string;
  name: string;
  closed: boolean;
}

export type SessionStatus = "setup" | "live" | "ended";

export interface DeskSession {
  id: string;
  title: string;
  /** yyyy-MM-dd */
  date: string;
  courts: DeskCourt[];
  matchingStyle: MatchingStyle;
  trackScores: boolean;
  targetScore: number;
  winBy2: boolean;
  /** Max rating gap for Skill Separated / Skill Courts. Missing means the default. */
  skillSpread?: number;
  status: SessionStatus;
  startedAt?: string;
  endedAt?: string;
}

export type QueueStatus = "waiting" | "playing" | "on_break" | "left";

export interface DeskQueueEntry {
  id: string;
  sessionId: string;
  playerId: string;
  position: number;
  status: QueueStatus;
  joinedAt: string;
  gamesPlayed: number;
  /** Marked gone home mid-game: leaves when the game finishes. */
  leaveAfterGame?: boolean;
  /** Asked for a break mid-game: goes on break when the game finishes. */
  breakAfterGame?: boolean;
}

export type Team = "A" | "B";

export interface DeskGame {
  id: string;
  sessionId: string;
  courtId: string;
  teamA: string[];
  teamB: string[];
  scoreA?: number;
  scoreB?: number;
  winner: Team | null;
  startedAt: string;
  endedAt?: string;
  correctedAt?: string;
}

export interface SessionState {
  session: DeskSession;
  queue: DeskQueueEntry[];
  games: DeskGame[];
  players: Record<string, DeskPlayer>;
}

export interface EngineCtx {
  now: string;
  newId: () => string;
  random?: () => number;
}

export type GameResult = { winner: Team } | { scoreA: number; scoreB: number };

export interface EngineError {
  error: string;
}

export function isEngineError(value: unknown): value is EngineError {
  return typeof value === "object" && value !== null && "error" in value;
}

export const SKILL_LEVELS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
export const DEFAULT_SKILL = 3.0;
