import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Coffee, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import type { DeskQueueEntry, SessionState } from "../engine/types";
import { markLeft, moveInQueue, setBreak } from "../engine/queue";
import type { EngineStep } from "../lib/boardController";
import { liveCtx } from "../lib/ctx";
import { trayFor } from "../lib/queueTray";
import { Button, IconButton } from "./ui";

type Apply = (label: string, fn: EngineStep, undoable?: boolean) => Promise<unknown>;

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <h3 className="mb-2 mt-6 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
      <span>{children}</span>
      {count !== undefined && <span className="font-mono tabular-nums">{count}</span>}
    </h3>
  );
}

/** The right-hand column: who's in line, who's on court, on a break, or gone home. */
export function QueuePanel({
  state,
  line,
  names,
  apply,
}: {
  state: SessionState;
  line: DeskQueueEntry[];
  names: (id: string) => string;
  apply: Apply;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showGone, setShowGone] = useState(false);
  const open = trayFor(openId, line);
  const byName = (a: DeskQueueEntry, b: DeskQueueEntry) => names(a.playerId).localeCompare(names(b.playerId));
  const playing = state.queue.filter((q) => q.status === "playing").sort(byName);
  const onBreak = state.queue.filter((q) => q.status === "on_break").sort(byName);
  const goneHome = state.queue.filter((q) => q.status === "left").sort(byName);

  function act(label: string, fn: EngineStep, undoable = false) {
    setOpenId(null);
    apply(label, fn, undoable);
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-line bg-sunken px-4 py-5 max-lg:border-t lg:border-l">
      <h2 className="mb-3 flex items-baseline justify-between">
        <span className="font-serif text-lg font-semibold">In line</span>
        <span className="font-mono text-sm tabular-nums text-muted">{line.length}</span>
      </h2>

      {line.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Nobody waiting. Check players in to fill the courts.
        </p>
      ) : (
        <ol className="space-y-1.5">
          <AnimatePresence initial={false}>
            {line.map((q, i) => {
              const isOpen = open === q.id;
              return (
                <motion.li
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={clsx("rounded-xl border border-line bg-surface", isOpen && "shadow-card")}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : q.id)}
                    className="flex min-h-12 w-full items-center gap-3 px-3 text-left"
                  >
                    <span className="w-5 font-mono text-[13px] tabular-nums text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{names(q.playerId)}</span>
                    <span className="shrink-0 text-xs text-muted">
                      <span className="font-mono tabular-nums">{q.gamesPlayed}</span> {q.gamesPlayed === 1 ? "game" : "games"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-4 gap-1.5 px-2 pb-2">
                      <TrayButton
                        label="Up"
                        disabled={i === 0}
                        onClick={() => act("Moved", (st) => moveInQueue(st, q.id, i - 1))}
                        icon={<ArrowUp size={16} />}
                      />
                      <TrayButton
                        label="Down"
                        disabled={i === line.length - 1}
                        onClick={() => act("Moved", (st) => moveInQueue(st, q.id, i + 1))}
                        icon={<ArrowDown size={16} />}
                      />
                      <TrayButton
                        label="Break"
                        onClick={() => act("On a break", (st) => setBreak(st, q.playerId, true, liveCtx()))}
                        icon={<Coffee size={16} />}
                      />
                      <TrayButton
                        label="Gone home"
                        onClick={() => act(`${names(q.playerId)} went home`, (st) => markLeft(st, q.playerId, liveCtx()), true)}
                        icon={<LogOut size={16} />}
                      />
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}

      {playing.length > 0 && (
        <>
          <SectionTitle count={playing.length}>On court</SectionTitle>
          <ul className="space-y-0.5">
            {playing.map((q) => (
              <li key={q.id} className="flex min-h-11 items-center gap-1 pl-1">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {names(q.playerId)}
                  {q.breakAfterGame && <span className="ml-2 text-xs text-clay">break after game</span>}
                  {q.leaveAfterGame && <span className="ml-2 text-xs text-clay">leaving after game</span>}
                </span>
                <IconButton
                  label={q.breakAfterGame ? `Cancel ${names(q.playerId)}'s break` : `${names(q.playerId)}: break after this game`}
                  onClick={() => apply("Break", (st) => setBreak(st, q.playerId, !q.breakAfterGame, liveCtx()))}
                  className={q.breakAfterGame ? "text-clay" : undefined}
                >
                  <Coffee size={16} />
                </IconButton>
                <IconButton
                  label={`${names(q.playerId)}: going home after this game`}
                  onClick={() => apply(`${names(q.playerId)} went home`, (st) => markLeft(st, q.playerId, liveCtx()), true)}
                  className={q.leaveAfterGame ? "text-clay" : undefined}
                >
                  <LogOut size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      )}

      {onBreak.length > 0 && (
        <>
          <SectionTitle count={onBreak.length}>On a break</SectionTitle>
          <ul className="space-y-1.5">
            {onBreak.map((q) => (
              <li key={q.id} className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface pl-3">
                <span className="min-w-0 flex-1 truncate text-[15px] text-muted">{names(q.playerId)}</span>
                <Button
                  variant="ghost"
                  className="text-t1"
                  onClick={() => apply(`${names(q.playerId)} is back`, (st) => setBreak(st, q.playerId, false, liveCtx()), true)}
                >
                  Back in line
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {goneHome.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showGone}
            onClick={() => setShowGone((v) => !v)}
            className="mt-6 flex min-h-11 items-center justify-between text-[11px] font-semibold uppercase tracking-[0.05em] text-muted"
          >
            <span>
              Gone home · <span className="font-mono tabular-nums">{goneHome.length}</span>
            </span>
            <ChevronDown size={16} className={clsx("transition-transform", showGone && "rotate-180")} />
          </button>
          {showGone && <p className="text-sm text-muted">{goneHome.map((q) => names(q.playerId)).join(", ")}</p>}
        </>
      )}
    </aside>
  );
}

function TrayButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg bg-sunken text-xs text-ink transition hover:bg-line active:scale-95 disabled:opacity-35"
    >
      {icon}
      {label}
    </button>
  );
}
