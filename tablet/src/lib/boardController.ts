import { UndoStack } from "../db/repo";
import { isEngineError, type EngineError, type SessionState } from "../engine/types";

export type EngineStep = (state: SessionState) => SessionState | EngineError;

/**
 * Runs live-board actions one at a time against the latest state, saves each one,
 * and keeps a single step of undo. Any later action cancels a pending undo, so undo
 * never throws away work done after it.
 */
export function createBoardController({
  initial,
  save,
  onState,
  onError,
}: {
  initial: SessionState;
  save: (state: SessionState) => Promise<void>;
  onState: (state: SessionState) => void;
  onError: (message: string) => void;
}) {
  let state = initial;
  let queue: Promise<unknown> = Promise.resolve();
  const undoStack = new UndoStack();

  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job, job);
    queue = run.catch(() => undefined);
    return run;
  }

  function run(label: string, step: EngineStep, undoable: boolean): Promise<SessionState | EngineError> {
    return enqueue(async () => {
      const next = step(state);
      if (isEngineError(next)) return next;
      try {
        await save(next);
      } catch {
        return { error: "That didn't save. Try again." };
      }
      if (undoable) undoStack.push(label, state);
      else undoStack.take();
      state = next;
      onState(next);
      return next;
    });
  }

  return {
    state: () => state,

    undoLabel: () => undoStack.peek()?.label ?? null,

    /** When the current undo window opened (ms since epoch), or null if there's nothing to undo. */
    undoStartedAt: () => undoStack.peek()?.at ?? null,

    /** Runs an action; any failure goes to onError. */
    async apply(label: string, step: EngineStep, undoable = false): Promise<SessionState | null> {
      const result = await run(label, step, undoable);
      if (isEngineError(result)) {
        onError(result.error);
        return null;
      }
      return result;
    },

    /** Runs an action and hands back its own failure instead of reporting it (for a sheet to show inline). */
    attempt(label: string, step: EngineStep, undoable = false): Promise<SessionState | EngineError> {
      return run(label, step, undoable);
    },

    undo(): Promise<SessionState | null> {
      return enqueue(async () => {
        const before = undoStack.take();
        if (!before) return null;
        try {
          await save(before);
        } catch {
          onError("Undo didn't save. Try again.");
          return null;
        }
        state = before;
        onState(before);
        return before;
      });
    },
  };
}

export type BoardController = ReturnType<typeof createBoardController>;
