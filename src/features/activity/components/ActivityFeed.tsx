"use client";

import { useState } from "react";
import { Activity, Flag, Lock, PlayCircle, Trophy, Users, Wrench, type LucideIcon } from "lucide-react";
import { formatPHTTime } from "@/lib/timezone";
import { describeEvent } from "@/features/activity/utils/describeEvent";
import { eventKind, groupEventsByDay, isHighlight, type EventKind } from "@/features/activity/utils/feedLayout";
import type { SessionEvent, SessionStatus } from "@/types";

const PAGE = 15;

const KIND_STYLE: Record<EventKind, { icon: LucideIcon; tile: string }> = {
  session: {
    icon: PlayCircle,
    tile: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  },
  game: {
    icon: Trophy,
    tile: "bg-lime-50 dark:bg-lime-950/40 border-lime-500/40 text-lime-700 dark:text-[#d4e938]",
  },
  court: {
    icon: Lock,
    tile: "bg-amber-50 dark:bg-amber-950/40 border-amber-500/30 text-amber-600 dark:text-amber-400",
  },
  fix: {
    icon: Wrench,
    tile: "bg-sky-50 dark:bg-sky-950/40 border-sky-500/30 text-sky-600 dark:text-sky-400",
  },
  queue: {
    icon: Users,
    tile: "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400",
  },
};

/** What's happened in this session, newest first, grouped by day. */
export function ActivityFeed({
  events,
  names,
  viewerId,
  sessionStatus,
}: {
  events: SessionEvent[];
  names: Record<string, string>;
  viewerId?: string;
  /** Before the start there is nothing real to report; the feed says so instead of listing stray events. */
  sessionStatus?: SessionStatus;
}) {
  const [shown, setShown] = useState(PAGE);
  const notStarted = sessionStatus === "scheduled";
  const isLive = sessionStatus === "active";
  const visible = notStarted ? [] : events.slice(0, shown);
  const days = groupEventsByDay(visible);

  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-5 sm:p-6 space-y-4 shadow-sm backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 id="activity-heading" className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Activity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Live updates from this session</p>
          </div>
        </div>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {notStarted || events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {notStarted
            ? "Activity starts when the session goes live: games, results and line changes show up here."
            : "Nothing has happened yet."}
        </p>
      ) : (
        <div className="space-y-4" aria-live="polite" aria-relevant="additions">
          {days.map((day) => (
            <div key={day.key} className="space-y-1.5">
              <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {day.label}
              </h3>
              <ol className="space-y-1.5">
                {day.events.map((e) => {
                  const kind = eventKind(e.type);
                  const style = KIND_STYLE[kind];
                  const Icon = e.type === "session_ended" ? Flag : style.icon;
                  const mine = Boolean(viewerId) && e.subject_ids.includes(viewerId!);
                  const strong = isHighlight(kind) || mine;
                  return (
                    <li
                      key={e.id}
                      className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 ${
                        mine
                          ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20"
                          : "border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 h-7 w-7 shrink-0 rounded-lg border flex items-center justify-center ${style.tile}`}
                        aria-hidden
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span
                        className={`min-w-0 flex-1 text-sm leading-6 ${
                          strong
                            ? "font-semibold text-slate-900 dark:text-slate-100"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {describeEvent(e, names, viewerId)}
                      </span>
                      <time
                        dateTime={e.created_at}
                        className="mt-0.5 shrink-0 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        {formatPHTTime(e.created_at)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      {!notStarted && events.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
        >
          Show more ({events.length - shown} older)
        </button>
      )}
    </section>
  );
}
