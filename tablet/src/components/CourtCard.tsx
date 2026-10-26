import clsx from "clsx";
import { motion } from "motion/react";
import type { DeskCourt, DeskGame } from "../engine/types";
import type { Teams } from "../engine/game";
import type { PillTone } from "../lib/courtStatus";
import { Avatar, Button, Menu, Pill, type MenuItem } from "./ui";

/**
 * One court seen from above: Team 1 | net | Team 2, with one main action underneath.
 * Tapping a player's name asks to swap that player.
 */
export function CourtCard({
  court,
  game,
  teams,
  pill,
  names,
  toggleLabel,
  onTapPlayer,
  onStart,
  onStartAnyway,
  onFinish,
  onToggleClosed,
  onSwapHint,
}: {
  court: DeskCourt;
  game?: DeskGame;
  teams: Teams | null;
  pill: { label: string; tone: PillTone };
  names: (id: string) => string;
  toggleLabel: string;
  onTapPlayer?: (playerId: string) => void;
  onStart?: () => void;
  /** Set when matchmaking is holding the court for a skill match: starts the best available four. */
  onStartAnyway?: () => void;
  onFinish?: () => void;
  onToggleClosed: () => void;
  onSwapHint?: () => void;
}) {
  const shown = game ? { teamA: game.teamA, teamB: game.teamB } : teams;
  const emptyClosed = court.closed && !game;
  const menu: MenuItem[] = [{ label: toggleLabel, onSelect: onToggleClosed }];
  if (game && onSwapHint) menu.push({ label: "Swap a player", onSelect: onSwapHint });

  return (
    <article
      className={clsx(
        "flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-3.5 shadow-card transition-opacity",
        emptyClosed && "opacity-60"
      )}
    >
      <header className="flex min-h-11 items-center gap-2.5 pl-1">
        <h2 className="truncate font-serif text-xl font-semibold tracking-[-0.01em]">{court.name}</h2>
        <Pill tone={pill.tone}>
          {pill.label.split(/(\d+)/).map((part, i) =>
            /^\d+$/.test(part) ? (
              <span key={i} className="font-mono tabular-nums">
                {part}
              </span>
            ) : (
              part
            )
          )}
        </Pill>
        <span className="flex-1" />
        <Menu label={`${court.name} options`} items={menu} />
      </header>

      <motion.div
        key={game?.id ?? "idle"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="relative grid min-h-[132px] grid-cols-2 overflow-hidden rounded-xl border-2 border-court-line bg-court"
      >
        <Side side="A" ids={shown?.teamA ?? []} names={names} dim={!game} closed={emptyClosed} onTap={onTapPlayer} />
        <Side side="B" ids={shown?.teamB ?? []} names={names} dim={!game} closed={emptyClosed} onTap={onTapPlayer} />
        {/* Net */}
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-court-line shadow-[0_0_0_1px_#00000012]" />
      </motion.div>

      {game && onFinish ? (
        <Button variant="primary" size="lg" onClick={onFinish}>
          Finish game
        </Button>
      ) : teams && onStart ? (
        <Button variant="primary" size="lg" onClick={onStart}>
          Start game
        </Button>
      ) : !teams && onStartAnyway ? (
        <Button size="lg" onClick={onStartAnyway}>
          Start anyway
        </Button>
      ) : (
        <Button size="lg" disabled className="text-muted">
          {emptyClosed ? "Court closed" : "Waiting for players"}
        </Button>
      )}
    </article>
  );
}

function Side({
  side,
  ids,
  names,
  dim,
  closed,
  onTap,
}: {
  side: "A" | "B";
  ids: string[];
  names: (id: string) => string;
  dim: boolean;
  closed: boolean;
  onTap?: (playerId: string) => void;
}) {
  const isA = side === "A";
  return (
    <div
      className={clsx(
        "relative flex flex-col gap-1.5 p-3",
        isA ? "items-start bg-[color-mix(in_srgb,var(--t1-bg)_70%,transparent)] pr-[21%]" : "items-end bg-[color-mix(in_srgb,var(--t2-bg)_70%,transparent)] pl-[21%]"
      )}
    >
      {/* Kitchen (non-volley zone) beside the net */}
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-y-0 w-[16%] border-dashed border-court-line",
          isA ? "right-0 border-l-2" : "left-0 border-r-2"
        )}
      />
      <span className={clsx("text-[11px] font-semibold uppercase tracking-[0.05em]", isA ? "text-t1" : "text-t2")}>
        {isA ? "Team 1" : "Team 2"}
      </span>
      {ids.length > 0
        ? ids.map((id) => (
            <button
              key={id}
              type="button"
              disabled={!onTap}
              onClick={() => onTap?.(id)}
              className={clsx(
                "relative flex min-h-11 max-w-full items-center gap-2 rounded-lg px-1 text-[15px] font-medium transition",
                isA ? "flex-row" : "flex-row-reverse text-right",
                dim ? "text-ink/75" : "text-ink",
                onTap && "hover:bg-surface/60 active:scale-[0.98]"
              )}
            >
              <Avatar name={names(id)} tone={isA ? "t1" : "t2"} size={26} />
              <span className="truncate">{names(id)}</span>
            </button>
          ))
        : !closed &&
          [0, 1].map((i) => (
            <span
              key={i}
              className="relative flex min-h-11 items-center rounded-full border-[1.5px] border-dashed border-line px-3 text-[13px] text-muted"
            >
              Open spot
            </span>
          ))}
    </div>
  );
}
