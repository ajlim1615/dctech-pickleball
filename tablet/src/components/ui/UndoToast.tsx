import { useEffect } from "react";
import { motion } from "motion/react";
import { UNDO_WINDOW_MS } from "../../db/repo";

/**
 * "Game finished · Undo" with a countdown bar. Keyed by `startedAt`, so a second
 * action with the same label restarts the countdown.
 */
export function UndoToast({
  label,
  startedAt,
  onUndo,
  onExpire,
}: {
  label: string;
  startedAt: number;
  onUndo: () => void;
  onExpire: () => void;
}) {
  const remaining = Math.max(0, UNDO_WINDOW_MS - (Date.now() - startedAt));

  useEffect(() => {
    const timer = setTimeout(onExpire, remaining);
    return () => clearTimeout(timer);
    // Restart only when a new action starts the window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <motion.div
        key={startedAt}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="pointer-events-auto relative flex items-center gap-4 overflow-hidden rounded-[14px] bg-ink py-1.5 pl-4 pr-1.5 text-bg shadow-card"
      >
        <span className="text-sm font-medium">{label}</span>
        <button
          type="button"
          onClick={onUndo}
          className="min-h-11 rounded-[10px] bg-[color-mix(in_srgb,var(--bg)_16%,transparent)] px-4 text-sm font-semibold"
        >
          Undo
        </button>
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-0 h-[3px] bg-primary"
          initial={{ width: `${(remaining / UNDO_WINDOW_MS) * 100}%` }}
          animate={{ width: "0%" }}
          transition={{ duration: remaining / 1000, ease: "linear" }}
        />
      </motion.div>
    </div>
  );
}
