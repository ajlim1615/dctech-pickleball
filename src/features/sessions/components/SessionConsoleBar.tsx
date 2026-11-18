"use client";

import { useTransition } from "react";
import { PlayCircle, Square, Users, LayoutGrid, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import { fillOpenCourts } from "@/features/queue/api/queueActions";
import { formatPHTTime } from "@/lib/timezone";
import type { ActiveCourtView, Session } from "@/types";

interface SessionConsoleBarProps {
  session: Session;
  status: Session["status"];
  courts: ActiveCourtView[];
  waitingCount: number;
  checkedInCount: number;
  onStart: () => void;
  isStarting: boolean;
  onAddPlayers: () => void;
  onEnd: () => void;
}

/**
 * Sticky admin control strip for running a session: one place for start,
 * adding players, filling courts and ending.
 */
export function SessionConsoleBar({
  session,
  status,
  courts,
  waitingCount,
  checkedInCount,
  onStart,
  isStarting,
  onAddPlayers,
  onEnd,
}: SessionConsoleBarProps) {
  const [isFilling, startFilling] = useTransition();
  const { message: notice, flash, clear } = useFlashMessage();

  const inPlay = courts.filter((c) => c.status === "occupied").length;
  const open = courts.filter((c) => c.status === "available" && !c.current_match_id).length;
  const isLive = status === "active";

  function handleFill() {
    clear();
    startFilling(async () => {
      const res = await fillOpenCourts(session.id);
      if (res?.error) {
        flash("error", res.error);
      } else {
        flash(
          "success",
          `Started ${res.filled} court${res.filled === 1 ? "" : "s"}${
            res.remainingOpen ? ` · ${res.remainingOpen} still open (no Up Next match ready)` : ""
          }`
        );
      }
    });
  }

  if (status !== "active" && status !== "scheduled") return null;

  return (
    <div className="sticky top-16 z-30 -mx-4 px-4 py-2 sm:py-3 border-y border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090d14]/95 backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-3 lg:gap-6">
        {/* Status + live counts */}
        <div className="flex items-center gap-x-5 gap-y-1.5 min-w-0 flex-wrap">
          {isLive ? (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live until {formatPHTTime(session.end_time)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Starts {formatPHTTime(session.start_time)}
            </span>
          )}
          <dl className="flex items-baseline gap-x-4 gap-y-1 flex-wrap text-sm">
            <Stat label="waiting" value={waitingCount} highlight={isLive && waitingCount >= 4 && open > 0} />
            <Stat label={`of ${courts.length} in play`} value={inPlay} />
            <Stat label="open" value={open} />
            <Stat label="checked in" value={checkedInCount} className="hidden sm:flex" />
          </dl>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:ml-auto">
          {!isLive && (
            <Button variant="volt" size="sm" onClick={onStart} disabled={isStarting} className="font-bold h-10 px-4 cursor-pointer">
              <PlayCircle className="h-4 w-4 mr-1.5" />
              {isStarting ? "Starting…" : "Start session"}
            </Button>
          )}

          {/* Adding players to the line only works once the session is live. */}
          {isLive && (
            <Button variant="outline" size="sm" onClick={onAddPlayers} aria-label="Add players" className="font-semibold h-10 px-3 cursor-pointer">
              <Users className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Add players</span>
            </Button>
          )}

          {isLive && (
            <>
              <Button
                variant={waitingCount >= 4 && open > 0 ? "volt" : "outline"}
                size="sm"
                onClick={handleFill}
                disabled={isFilling || open === 0 || waitingCount < 4}
                className="font-bold h-10 cursor-pointer disabled:cursor-not-allowed"
                title="Start the Up Next matches on every open court"
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                {isFilling ? "Starting…" : <><span className="sm:hidden">Fill courts</span><span className="hidden sm:inline">Fill open courts</span></>}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onEnd}
                className="font-semibold h-10 px-2 sm:px-3 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 mr-1.5" />
                End<span className="hidden sm:inline">&nbsp;session</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-2 flex items-center justify-between gap-2 text-sm ${
            notice.kind === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          }`}
        >
          <span>{notice.text}</span>
          {notice.kind === "error" && (
            <IconButton label="Dismiss message" onClick={clear} tone="danger">
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  className = "flex",
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={`${className} items-baseline gap-1 ${highlight ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
      <dt className="sr-only">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</dd>
      <span aria-hidden>{label}</span>
    </div>
  );
}
