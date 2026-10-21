import { useEffect } from "react";
import { UNDO_WINDOW_MS } from "../db/repo";

/** "Game finished · Undo" for 10 seconds after an action. */
export function UndoBar({ label, onUndo, onExpire }: { label: string; onUndo: () => void; onExpire: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onExpire, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [label, onExpire]);

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="flex items-center gap-4 rounded-xl bg-slate-100 py-1 pl-4 pr-1 text-slate-950 shadow-lg">
        <span className="text-sm font-medium">{label}</span>
        <button type="button" onClick={onUndo} className="min-h-11 rounded-lg px-4 text-sm font-semibold hover:bg-slate-200">
          Undo
        </button>
      </div>
    </div>
  );
}
