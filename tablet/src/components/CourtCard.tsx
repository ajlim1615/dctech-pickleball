import clsx from "clsx";
import type { DeskCourt, DeskGame } from "../engine/types";
import type { Teams } from "../engine/game";
import { Button } from "./ui";

type Mode =
  | { kind: "playing"; game: DeskGame; minutes: number }
  | { kind: "suggested"; teams: Teams }
  | { kind: "waiting"; waitingFor: number }
  | { kind: "closed" };

/**
 * One court seen from above: Team 1 | net | Team 2.
 * Tapping a name asks to swap that player.
 */
export function CourtCard({
  court,
  mode,
  names,
  onTapPlayer,
  onStart,
  onFinish,
  onToggleClosed,
}: {
  court: DeskCourt;
  mode: Mode;
  names: (id: string) => string;
  onTapPlayer?: (playerId: string) => void;
  onStart?: () => void;
  onFinish?: () => void;
  onToggleClosed: () => void;
}) {
  const teams =
    mode.kind === "playing"
      ? { teamA: mode.game.teamA, teamB: mode.game.teamB }
      : mode.kind === "suggested"
        ? mode.teams
        : { teamA: [], teamB: [] };
  const closed = mode.kind === "closed";

  return (
    <div className={clsx("flex flex-col gap-3 rounded-xl border bg-card p-3", closed ? "border-border opacity-60" : "border-border")}>
      <div className="flex min-h-11 items-center justify-between gap-2 px-1">
        <div>
          <span className="font-semibold">{court.name}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {mode.kind === "playing" && (
              <>
                Playing · <span className="font-mono tabular-nums">{mode.minutes}</span> min
              </>
            )}
            {mode.kind === "suggested" && "Up next"}
            {mode.kind === "waiting" && (
              <>
                Waiting for <span className="font-mono tabular-nums">{mode.waitingFor}</span> more{" "}
                {mode.waitingFor === 1 ? "player" : "players"}
              </>
            )}
            {closed && "Closed"}
          </span>
        </div>
        <Button variant="ghost" onClick={onToggleClosed} className="px-3 text-xs">
          {closed ? "Reopen" : "Close court"}
        </Button>
      </div>

      <div
        className={clsx(
          "relative grid grid-cols-[1fr_6px_1fr] overflow-hidden rounded-xl border-2",
          closed ? "border-slate-700 bg-slate-800/60" : "border-slate-600/70 bg-slate-950/60"
        )}
      >
        <Half side="A" ids={teams.teamA} names={names} dim={mode.kind === "suggested"} onTap={onTapPlayer} closed={closed} />
        <div aria-hidden className="relative bg-slate-600">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-400/60" />
        </div>
        <Half side="B" ids={teams.teamB} names={names} dim={mode.kind === "suggested"} onTap={onTapPlayer} closed={closed} />
      </div>

      {mode.kind === "playing" && onFinish && (
        <Button variant="primary" onClick={onFinish}>
          Finish game
        </Button>
      )}
      {mode.kind === "suggested" && onStart && (
        <Button variant="primary" onClick={onStart}>
          Start game
        </Button>
      )}
    </div>
  );
}

function Half({
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
  const tone = isA ? "text-team1" : "text-team2";
  return (
    <div className={clsx("relative min-h-32", isA ? "bg-team1/5" : "bg-team2/5")}>
      {/* Kitchen (non-volley zone) beside the net */}
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-y-0 w-[22%] border-dashed border-slate-600/70 bg-slate-800/30",
          isA ? "right-0 border-l" : "left-0 border-r"
        )}
      />
      <div className={clsx("relative flex flex-col gap-1 p-3", isA ? "items-start pr-[24%]" : "items-end pl-[24%] text-right")}>
        <span className={clsx("text-xs font-semibold", tone)}>{isA ? "Team 1" : "Team 2"}</span>
        {ids.length > 0
          ? ids.map((id) => (
              <button
                key={id}
                type="button"
                disabled={!onTap}
                onClick={() => onTap?.(id)}
                className={clsx(
                  "min-h-11 max-w-full truncate rounded-md px-1 text-base font-medium",
                  dim ? "text-slate-300" : "text-foreground",
                  onTap && "underline decoration-slate-600 decoration-dotted underline-offset-4"
                )}
              >
                {names(id)}
              </button>
            ))
          : !closed &&
            [0, 1].map((i) => (
              <span key={i} className="flex min-h-11 items-center text-sm text-slate-500">
                Open spot
              </span>
            ))}
      </div>
    </div>
  );
}
