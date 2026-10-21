import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "./db";
import {
  createSession,
  deletePlayer,
  getLiveSession,
  loadSessionState,
  saveSessionState,
  upsertPlayer,
  UndoStack,
} from "./repo";
import { checkIn, startGame } from "../engine/game";
import { makeCtx, makeState } from "../engine/fixtures";
import { isEngineError, type SessionState } from "../engine/types";

async function seed(): Promise<SessionState> {
  const ctx = makeCtx();
  let s = checkIn(makeState(6), ["p1", "p2", "p3", "p4", "p5"], ctx);
  const started = startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx);
  if (isEngineError(started)) throw new Error(started.error);
  s = started;
  for (const p of Object.values(s.players)) await upsertPlayer(p);
  await createSession(s.session);
  await saveSessionState(s);
  return s;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("repo", () => {
  it("save then load round-trips a session state", async () => {
    const s = await seed();
    const loaded = await loadSessionState("s1");
    expect(loaded.session).toEqual(s.session);
    expect(loaded.queue).toEqual(expect.arrayContaining(s.queue));
    expect(loaded.queue).toHaveLength(s.queue.length);
    expect(loaded.games).toEqual(s.games);
    expect(Object.keys(loaded.players).sort()).toEqual(Object.keys(s.players).sort());
  });

  it("deletePlayer refuses a player with games", async () => {
    await seed();
    expect(isEngineError(await deletePlayer("p1"))).toBe(true);
    expect(await deletePlayer("p6")).toBeUndefined();
    expect(await db.players.get("p6")).toBeUndefined();
  });

  it("getLiveSession returns the live one", async () => {
    await seed();
    await createSession({ ...makeState().session, id: "old", status: "ended" });
    expect((await getLiveSession())?.id).toBe("s1");
  });

  it("a failed save leaves the previous rows intact", async () => {
    const s = await seed();
    const broken = {
      ...s,
      queue: [],
      games: [...s.games, { ...s.games[0], id: undefined as unknown as string }],
    };
    await expect(saveSessionState(broken)).rejects.toThrow();
    const loaded = await loadSessionState("s1");
    expect(loaded.queue).toHaveLength(s.queue.length);
    expect(loaded.games).toEqual(s.games);
  });
});

describe("UndoStack", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("expires after 10 s", () => {
    const undo = new UndoStack();
    const state = makeState();
    undo.push("Finish game", state);
    expect(undo.peek()?.label).toBe("Finish game");
    vi.advanceTimersByTime(10_001);
    expect(undo.peek()).toBeUndefined();
    expect(undo.take()).toBeUndefined();
  });

  it("take returns the snapshot once", () => {
    const undo = new UndoStack();
    const state = makeState();
    undo.push("Gone home", state);
    expect(undo.take()).toBe(state);
    expect(undo.take()).toBeUndefined();
  });
});
