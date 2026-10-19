"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, Square, Users, LayoutGrid } from "lucide-react";
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

          <Button variant="outline" size="sm" onClick={onAddPlayers} aria-label="Add players" className="font-semibold h-10 px-3 cursor-pointer">
            <Users className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add players</span>
          </Button>

          {isLive && (
            <>
              <Button
                variant={waitingCount >= 4 && open > 0 ? "volt" : "outline"}
                size="sm"
                onClick={handleFill}
                disabled={isFilling || open === 0 || waitingCount < 4}
                className="font-bold h-10 cursor-pointer disabled:cursor-not-allowed"
                title="Call the next group from the queue onto every open court"
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                {isFilling ? "Filling…" : <><span className="sm:hidden">Fill courts</span><span className="hidden sm:inline">Fill open courts</span></>}
              </Button>

              <button
                type="button"
                role="switch"
                aria-checked={autoFill}
                onClick={() => onAutoFillChange(!autoFill)}
                className="inline-flex items-center gap-2 h-10 rounded-md px-1.5 sm:px-2.5 text-sm font-medium whitespace-nowrap text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
                title="When on, submitting a result calls the next 4 onto that court"
              >
                <span
                  aria-hidden
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                    autoFill ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      autoFill ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span className="sm:hidden">Auto</span>
                <span className="hidden sm:inline">Auto-fill courts</span>
              </button>

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
        <p
          role="status"
          className={`mt-2 text-sm ${
            notice.tone === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {notice.text}
        </p>
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
