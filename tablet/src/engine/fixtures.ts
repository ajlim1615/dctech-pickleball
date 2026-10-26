import { seededRandom } from "@/features/queue/matchmaking";
import type { DeskPlayer, DeskSession, EngineCtx, SessionState } from "./types";

/** Test helpers: a live session with numbered players and a deterministic context. */
export function makeCtx(seed = "t"): EngineCtx {
  let n = 0;
  let minute = 0;
  const ctx: EngineCtx = {
    get now() {
      minute += 1;
      return new Date(Date.UTC(2026, 9, 21, 18, minute)).toISOString();
    },
    newId: () => `id${++n}`,
    random: seededRandom(seed),
  };
  return ctx;
}

export function makePlayers(count: number, skill = (i: number) => 3.0 + (i % 4) * 0.5): DeskPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    skill: skill(i),
    archived: false,
    createdAt: "2026-10-01T00:00:00.000Z",
  }));
}

export function makeSession(overrides: Partial<DeskSession> = {}): DeskSession {
  return {
    id: "s1",
    title: "Tuesday open play",
    date: "2026-10-21",
    courts: [
      { id: "c1", name: "Court 1", closed: false },
      { id: "c2", name: "Court 2", closed: false },
    ],
    matchingStyle: "fifo",
    trackScores: true,
    targetScore: 11,
    winBy2: true,
    status: "live",
    ...overrides,
  };
}

export function makeState(playerCount = 9, overrides: Partial<DeskSession> = {}): SessionState {
  const players = makePlayers(playerCount);
  return {
    session: makeSession(overrides),
    queue: [],
    games: [],
    players: Object.fromEntries(players.map((p) => [p.id, p])),
  };
}
