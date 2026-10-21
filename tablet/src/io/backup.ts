import { z } from "zod";
import { db } from "../db/db";

export const BACKUP_FORMAT = 1;
const APP = "pickleball-desk";

const player = z.object({
  id: z.string(),
  name: z.string(),
  skill: z.number(),
  note: z.string().optional(),
  archived: z.boolean(),
  createdAt: z.string(),
});

const session = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  courts: z.array(z.object({ id: z.string(), name: z.string(), closed: z.boolean() })),
  matchingStyle: z.enum([
    "balanced",
    "social_mixer",
    "skill_separated",
    "winners_losers",
    "skill_courts",
    "mixed_doubles",
    "king_queen",
    "club_wars",
    "fifo",
    "winners_stay",
  ]),
  trackScores: z.boolean(),
  targetScore: z.number(),
  winBy2: z.boolean(),
  status: z.enum(["setup", "live", "ended"]),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
});

const queueEntry = z.object({
  id: z.string(),
  sessionId: z.string(),
  playerId: z.string(),
  position: z.number(),
  status: z.enum(["waiting", "playing", "on_break", "left"]),
  joinedAt: z.string(),
  gamesPlayed: z.number(),
  leaveAfterGame: z.boolean().optional(),
  breakAfterGame: z.boolean().optional(),
});

const game = z.object({
  id: z.string(),
  sessionId: z.string(),
  courtId: z.string(),
  teamA: z.array(z.string()),
  teamB: z.array(z.string()),
  scoreA: z.number().optional(),
  scoreB: z.number().optional(),
  winner: z.enum(["A", "B"]).nullable(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  correctedAt: z.string().optional(),
});

const backupSchema = z.object({
  app: z.literal(APP),
  format: z.number().int(),
  exportedAt: z.string(),
  players: z.array(player),
  sessions: z.array(session),
  queueEntries: z.array(queueEntry),
  games: z.array(game),
});

export type BackupData = z.infer<typeof backupSchema>;

export async function serializeBackup(): Promise<string> {
  const [players, sessions, queueEntries, games] = await Promise.all([
    db.players.toArray(),
    db.sessions.toArray(),
    db.queueEntries.toArray(),
    db.games.toArray(),
  ]);
  const data: BackupData = {
    app: APP,
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    players,
    sessions,
    queueEntries,
    games,
  };
  return JSON.stringify(data);
}

export function parseBackup(text: string): { ok: true; data: BackupData } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "This file isn't a Pickleball Desk backup (it can't be read)." };
  }
  if (typeof raw !== "object" || raw === null || (raw as { app?: unknown }).app !== APP) {
    return { ok: false, reason: "This file isn't a Pickleball Desk backup." };
  }
  const format = (raw as { format?: unknown }).format;
  if (typeof format === "number" && format > BACKUP_FORMAT) {
    return { ok: false, reason: "This backup was made by a newer version of the app. Update the app first." };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "This backup is damaged or incomplete, so nothing was changed." };
  return { ok: true, data: parsed.data };
}

/** Replaces everything on the tablet with the backup, in one transaction. */
export async function restoreBackup(data: BackupData): Promise<void> {
  await db.transaction("rw", [db.players, db.sessions, db.queueEntries, db.games], async () => {
    await Promise.all([db.players.clear(), db.sessions.clear(), db.queueEntries.clear(), db.games.clear()]);
    await db.players.bulkAdd(data.players);
    await db.sessions.bulkAdd(data.sessions);
    await db.queueEntries.bulkAdd(data.queueEntries);
    await db.games.bulkAdd(data.games);
  });
}

export function backupFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `pickleball-desk-backup-${y}-${m}-${d}.json`;
}
