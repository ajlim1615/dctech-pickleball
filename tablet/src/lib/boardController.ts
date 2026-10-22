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

  return {
    state: () => state,

    undoLabel: () => undoStack.peek()?.label ?? null,

    /** When the current undo window opened (ms since epoch), or null if there's nothing to undo. */
    undoStartedAt: () => undoStack.peek()?.at ?? null,

    apply(label: string, step: EngineStep, undoable = false): Promise<SessionState | null> {
      return enqueue(async () => {
        const next = step(state);
        if (isEngineError(next)) {
          onError(next.error);
          return null;
        }
        try {
          await save(next);
        } catch {
          onError("That didn't save. Try again.");
          return null;
        }
        if (undoable) undoStack.push(label, state);
        else undoStack.take();
        state = next;
        onState(next);
        return next;
      });
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
