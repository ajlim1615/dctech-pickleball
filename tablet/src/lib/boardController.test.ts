import { describe, it, expect } from "vitest";
import { createBoardController } from "./boardController";
import { checkIn, finishGame, startGame, activeGameOnCourt } from "../engine/game";
import { moveInQueue } from "../engine/queue";
import { makeCtx, makeState } from "../engine/fixtures";
import { isEngineError, type SessionState } from "../engine/types";

function setup(initial: SessionState) {
  const saved: SessionState[] = [];
  let current = initial;
  const controller = createBoardController({
    initial,
    save: async (s) => {
      await new Promise((r) => setTimeout(r, 1));
      saved.push(s);
    },
    onState: (s) => {
      current = s;
    },
    onError: () => {},
  });
  return { controller, saved, current: () => current };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("board controller", () => {
  it("a later action cancels the pending undo", async () => {
    const ctx = makeCtx();
    let s = checkIn(makeState(9), ids(4), ctx);
    const started = startGame(s, "c1", { teamA: ["p1", "p2"], teamB: ["p3", "p4"] }, ctx);
    if (isEngineError(started)) throw new Error(started.error);
    s = started;
    const { controller, current } = setup(s);
    const gameId = activeGameOnCourt(s, "c1")!.id;

    await controller.apply("Game finished", (st) => finishGame(st, gameId, { scoreA: 11, scoreB: 3 }, ctx), true);
    expect(controller.undoLabel()).toBe("Game finished");
    await controller.apply("Checked in", (st) => checkIn(st, ["p5"], ctx));
    expect(controller.undoLabel()).toBeNull();

    await controller.undo();
    expect(current().queue.some((q) => q.playerId === "p5")).toBe(true);
  });

  it("reports when the current undo window started", async () => {
    const ctx = makeCtx();
    const s = checkIn(makeState(9), ids(4), ctx);
    const { controller } = setup(s);
    expect(controller.undoStartedAt()).toBeNull();
    const before = Date.now();
    await controller.apply("Checked in", (st) => checkIn(st, ["p5"], ctx), true);
    expect(controller.undoStartedAt()).toBeGreaterThanOrEqual(before);
    await controller.apply("Checked in", (st) => checkIn(st, ["p6"], ctx));
    expect(controller.undoStartedAt()).toBeNull();
  });

  it("undo right after the action restores the state before it", async () => {
    const ctx = makeCtx();
    const s = checkIn(makeState(9), ids(4), ctx);
    const { controller, current } = setup(s);
    await controller.apply("Checked in", (st) => checkIn(st, ["p5"], ctx), true);
    await controller.undo();
    expect(current()).toEqual(s);
  });

  it("taps made before the previous save finishes all apply", async () => {
    const ctx = makeCtx();
    const s = checkIn(makeState(9), ids(4), ctx);
    const { controller, current, saved } = setup(s);
    const p4 = s.queue.find((q) => q.playerId === "p4")!.id;
    await Promise.all([
      controller.apply("Moved", (st) => moveInQueue(st, p4, 2)),
      controller.apply("Moved", (st) => moveInQueue(st, p4, 1)),
      controller.apply("Moved", (st) => moveInQueue(st, p4, 0)),
    ]);
    const line = current()
      .queue.filter((q) => q.status === "waiting")
      .sort((a, b) => a.position - b.position)
      .map((q) => q.playerId);
    expect(line[0]).toBe("p4");
    expect(saved).toHaveLength(3);
  });

  it("a failed save keeps the previous state and reports it", async () => {
    const ctx = makeCtx();
    const s = checkIn(makeState(9), ids(4), ctx);
    const errors: string[] = [];
    let current = s;
    const controller = createBoardController({
      initial: s,
      save: async () => {
        throw new Error("disk full");
      },
      onState: (st) => (current = st),
      onError: (m) => errors.push(m),
    });
    const result = await controller.apply("Checked in", (st) => checkIn(st, ["p5"], ctx));
    expect(result).toBeNull();
    expect(current).toBe(s);
    expect(errors).toHaveLength(1);
  });
});
