import Dexie, { type EntityTable } from "dexie";
import type { DeskGame, DeskPlayer, DeskQueueEntry, DeskSession } from "../engine/types";

export interface MetaRow {
  key: string;
  value: string;
}

/** Everything the app keeps, in the tablet's own storage. */
export const db = new Dexie("pickleball-desk") as Dexie & {
  players: EntityTable<DeskPlayer, "id">;
  sessions: EntityTable<DeskSession, "id">;
  queueEntries: EntityTable<DeskQueueEntry, "id">;
  games: EntityTable<DeskGame, "id">;
  meta: EntityTable<MetaRow, "key">;
};

db.version(1).stores({
  players: "id, name, archived",
  sessions: "id, status, date",
  queueEntries: "id, sessionId, playerId",
  games: "id, sessionId, courtId",
  meta: "key",
});
