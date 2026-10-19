"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, Square, Users, Zap, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fillOpenCourts } from "@/features/queue/api/queueActions";
import { formatPHTTime } from "@/lib/timezone";
import type { ActiveCourtView, Session } from "@/types";

const AUTO_FILL_KEY = "pb_admin_auto_fill";

const AUTO_FILL_EVENT = "pb-auto-fill-change";

function readAutoFill() {
  try {
    return localStorage.getItem(AUTO_FILL_KEY) !== "0";
  } catch {
    return true;
  }
}

function subscribeAutoFill(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTO_FILL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTO_FILL_EVENT, onChange);
  };
}

/** The admin's auto-fill preference, remembered per browser; defaults to on. */
export function useAutoFillPreference() {
  const autoFill = useSyncExternalStore(subscribeAutoFill, readAutoFill, () => true);

  function update(next: boolean) {
    try {
      localStorage.setItem(AUTO_FILL_KEY, next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(AUTO_FILL_EVENT));
  }

  return [autoFill, update] as const;
}

interface SessionConsoleBarProps {
  session: Session;
  status: Session["status"];
  courts: ActiveCourtView[];
  waitingCount: number;
  checkedInCount: number;
  autoFill: boolean;
  onAutoFillChange: (next: boolean) => void;
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
  autoFill,
  onAutoFillChange,
  onStart,
  isStarting,
  onAddPlayers,
  onEnd,
}: SessionConsoleBarProps) {
  const router = useRouter();
  const [isFilling, startFilling] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const inPlay = courts.filter((c) => c.status === "occupied").length;
  const open = courts.filter((c) => c.status === "available" && !c.current_match_id).length;
  const isLive = status === "active";

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  function handleFill() {
    startFilling(async () => {
      const res = await fillOpenCourts(session.id);
      if (res?.error) {
        setNotice({ tone: "warn", text: res.error });
      } else {
        setNotice({
          tone: "ok",
          text: `Filled ${res.filled} court${res.filled === 1 ? "" : "s"}${
            res.remainingOpen ? ` · ${res.remainingOpen} still open (not enough players)` : ""
          }`,
        });
        router.refresh();
      }
    });
  }

  if (status !== "active" && status !== "scheduled") return null;

  return (
    <div className="sticky top-16 z-30 -mx-4 px-4 py-2.5 border-y border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090d14]/95 backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 lg:gap-4">
        {/* Status + live counts */}
        <div className="flex items-center gap-3 text-xs font-mono min-w-0 flex-wrap">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              LIVE · ends {formatPHTTime(session.end_time)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              NOT STARTED · {formatPHTTime(session.start_time)}
            </span>
          )}
          <Stat label="checked in" value={checkedInCount} />
          <Stat label="waiting" value={waitingCount} highlight={isLive && waitingCount >= 4 && open > 0} />
          <Stat label="in play" value={`${inPlay}/${courts.length}`} />
          <Stat label="open" value={open} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap lg:ml-auto">
          {!isLive ? (
            <Button
              variant="volt"
              size="sm"
              onClick={onStart}
              disabled={isStarting}
              className="font-bold h-9 cursor-pointer"
            >
              <PlayCircle className="h-4 w-4 mr-1.5" />
              {isStarting ? "Starting..." : "Start session"}
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={onAddPlayers}
            className="font-bold h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 cursor-pointer"
          >
            <Users className="h-4 w-4 mr-1.5" />
            Add players
          </Button>

          {isLive && (
            <>
              <Button
                variant={waitingCount >= 4 && open > 0 ? "volt" : "outline"}
                size="sm"
                onClick={handleFill}
                disabled={isFilling || open === 0 || waitingCount < 4}
                className="font-bold h-9 cursor-pointer disabled:cursor-not-allowed"
                title="Call the next group from the queue onto every open court"
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                {isFilling ? "Filling..." : `Fill open courts${open ? ` (${open})` : ""}`}
              </Button>

              <label
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                title="After a result is submitted, automatically call the next 4 onto that court"
              >
                <input
                  type="checkbox"
                  checked={autoFill}
                  onChange={(e) => onAutoFillChange(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Auto-fill
              </label>

              <Button
                variant="outline"
                size="sm"
                onClick={onEnd}
                className="font-bold h-9 text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 mr-1.5" />
                End session
              </Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <p
          className={`mt-2 text-xs font-mono ${
            notice.tone === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <span className={highlight ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
      <span className="font-bold text-slate-900 dark:text-slate-100">{value}</span> {label}
    </span>
  );
}
