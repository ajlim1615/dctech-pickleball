"use client";

import { useEffect } from "react";
import type { LastCourtChange } from "@/features/courts/hooks/useCourtActions";

const UNDO_MS = 10_000;

/** "Replaced · Undo" for 10 seconds after a live-court change. */
export function UndoToast({
  change,
  onUndo,
  onDismiss,
}: {
  change: LastCourtChange;
  onUndo: (change: LastCourtChange) => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, Math.max(0, UNDO_MS - (Date.now() - change.at)));
    return () => clearTimeout(t);
  }, [change, onDismiss]);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
    >
      <span className="min-w-0 truncate">{change.message}</span>
      <button
        type="button"
        onClick={() => onUndo(change)}
        className="h-9 shrink-0 rounded-lg bg-white px-3 text-sm font-bold text-slate-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        Undo
      </button>
    </div>
  );
}
