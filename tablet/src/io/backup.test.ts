import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db/db";
import { createSession, saveSessionState, upsertPlayer } from "../db/repo";
import { BACKUP_FORMAT, backupFileName, parseBackup, restoreBackup, serializeBackup } from "./backup";
import { checkIn } from "../engine/game";
import { makeCtx, makeState } from "../engine/fixtures";

async function seed() {
  const s = checkIn(makeState(5), ["p1", "p2"], makeCtx());
  for (const p of Object.values(s.players)) await upsertPlayer(p);
  await createSession(s.session);
  await saveSessionState(s);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("backup", () => {
  it("round-trips through serialize, parse and restore", async () => {
    await seed();
    const text = await serializeBackup();
    await Promise.all(db.tables.map((t) => t.clear()));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.reason);
    await restoreBackup(parsed.data);
    expect(await db.players.count()).toBe(5);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.queueEntries.count()).toBe(2);
  });

  it("rejects invalid JSON, another app, and a newer format", async () => {
    await seed();
    const good = JSON.parse(await serializeBackup());
    const cases = [
      "not json {",
      JSON.stringify({ ...good, app: "something-else" }),
      JSON.stringify({ ...good, format: BACKUP_FORMAT + 1 }),
      JSON.stringify({ ...good, players: [{ id: 1 }] }),
    ];
    for (const text of cases) {
      const result = parseBackup(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("a rejected restore leaves existing data untouched", async () => {
    await seed();
    const result = parseBackup(JSON.stringify({ app: "pickleball-desk", format: 1, players: "nope" }));
    expect(result.ok).toBe(false);
    expect(await db.players.count()).toBe(5);
  });

  it("names the file by date", () => {
    expect(backupFileName(new Date(2026, 9, 21))).toBe("pickleball-desk-backup-2026-10-21.json");
  });
});
