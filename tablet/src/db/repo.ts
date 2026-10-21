import { db } from "./db";
import type { DeskPlayer, DeskSession, EngineError, SessionState } from "../engine/types";

export async function loadSessionState(sessionId: string): Promise<SessionState> {
  const [session, queue, games, players] = await Promise.all([
    db.sessions.get(sessionId),
    db.queueEntries.where("sessionId").equals(sessionId).toArray(),
    db.games.where("sessionId").equals(sessionId).toArray(),
    db.players.toArray(),
  ]);
  if (!session) throw new Error("That session no longer exists.");
  return { session, queue, games, players: Object.fromEntries(players.map((p) => [p.id, p])) };
}

/**
 * Saves a session's state in one transaction: the session row, its whole queue and games,
 * and any players that aren't in the roster yet (walk-ins). It all lands, or none of it does.
 */
export async function saveSessionState(next: SessionState): Promise<void> {
  const sessionId = next.session.id;
  await db.transaction("rw", [db.sessions, db.queueEntries, db.games, db.players], async () => {
    await db.sessions.put(next.session);
    await db.queueEntries.where("sessionId").equals(sessionId).delete();
    await db.queueEntries.bulkAdd(next.queue);
    await db.games.where("sessionId").equals(sessionId).delete();
    await db.games.bulkAdd(next.games);
    const known = new Set(await db.players.toCollection().primaryKeys());
    const walkIns = Object.values(next.players).filter((p) => !known.has(p.id));
    if (walkIns.length) await db.players.bulkAdd(walkIns);
  });
}

export async function getLiveSession(): Promise<DeskSession | undefined> {
  return db.sessions.where("status").equals("live").first();
}

/** Newest first. */
export async function listSessions(): Promise<DeskSession[]> {
  const sessions = await db.sessions.toArray();
  return sessions.sort((a, b) => (b.date + (b.startedAt ?? "")).localeCompare(a.date + (a.startedAt ?? "")));
}

export async function listPlayers({ includeArchived = false } = {}): Promise<DeskPlayer[]> {
  const players = await db.players.toArray();
  return players
    .filter((p) => includeArchived || !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function upsertPlayer(player: DeskPlayer): Promise<void> {
  await db.players.put(player);
}

/** Deletes a player who has never played. Anyone with games is archived instead. */
export async function deletePlayer(id: string): Promise<EngineError | void> {
  const games = await db.games.toArray();
  if (games.some((g) => g.teamA.includes(id) || g.teamB.includes(id))) {
    return { error: "This player has games on record. Archive them instead." };
  }
  await db.transaction("rw", [db.players, db.queueEntries], async () => {
    await db.queueEntries.where("playerId").equals(id).delete();
    await db.players.delete(id);
  });
}

export async function createSession(session: DeskSession): Promise<void> {
  await db.sessions.put(session);
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}

export const UNDO_WINDOW_MS = 10_000;

/** One step of undo, kept in memory for 10 seconds after an action. */
export class UndoStack {
  private entry: { label: string; before: SessionState; at: number } | undefined;

  push(label: string, before: SessionState): void {
    this.entry = { label, before, at: Date.now() };
  }

  peek(): { label: string; before: SessionState; at: number } | undefined {
    if (this.entry && Date.now() - this.entry.at > UNDO_WINDOW_MS) this.entry = undefined;
    return this.entry;
  }

  take(): SessionState | undefined {
    const entry = this.peek();
    this.entry = undefined;
    return entry?.before;
  }
}
