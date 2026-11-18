"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Flag, Lock, PlayCircle, Search, Trophy, Users, Wrench, type LucideIcon } from "lucide-react";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { formatPHTTime } from "@/lib/timezone";
import { buildMatchTeams, describeEvent, type MatchTeams } from "@/features/activity/utils/describeEvent";
import { eventKind, groupEventsByDay, isHighlight, type EventKind } from "@/features/activity/utils/feedLayout";
import type { SessionEvent, SessionStatus } from "@/types";

const PAGE_SIZE = 15;

type FeedFilter = "all" | "game" | "queue" | "court";

const FILTER_OPTIONS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "game", label: "Games" },
  { id: "queue", label: "Queue" },
  { id: "court", label: "Courts & Fixes" },
];

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
  avatars,
  viewerId,
  sessionStatus,
  matchTeams: initialMatchTeams,
  courtNames,
}: {
  events: SessionEvent[];
  names: Record<string, string>;
  avatars?: Record<string, string | null>;
  viewerId?: string;
  /** Before the start there is nothing real to report; the feed says so instead of listing stray events. */
  sessionStatus?: SessionStatus;
  matchTeams?: Record<string, MatchTeams>;
  courtNames?: Record<string, string>;
}) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [query, setQuery] = useState("");
  const notStarted = sessionStatus === "scheduled";
  const isLive = sessionStatus === "active";
  const matchTeams = useMemo(
    () => buildMatchTeams(events, initialMatchTeams),
    [events, initialMatchTeams]
  );

  const described = useMemo(() => {
    if (notStarted) return [];
    return events.map((e) => {
      const kind = eventKind(e.type);
      const text = describeEvent(e, names, viewerId, matchTeams, courtNames);
      return { event: e, kind, text };
    });
  }, [notStarted, events, names, viewerId, matchTeams, courtNames]);

  const counts = useMemo(() => {
    const c: Record<FeedFilter, number> = { all: described.length, game: 0, queue: 0, court: 0 };
    for (const item of described) {
      if (item.kind === "game") c.game++;
      else if (item.kind === "queue") c.queue++;
      else if (item.kind === "court" || item.kind === "fix") c.court++;
    }
    return c;
  }, [described]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return described.filter((item) => {
      if (filter === "game" && item.kind !== "game") return false;
      if (filter === "queue" && item.kind !== "queue") return false;
      if (filter === "court" && item.kind !== "court" && item.kind !== "fix") return false;
      if (q && !item.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [described, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const textById = useMemo(
    () => new Map(pageItems.map((item) => [item.event.id, item.text])),
    [pageItems]
  );
  const days = groupEventsByDay(pageItems.map((item) => item.event));

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
        <>
          {/* Filter chips & search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
              {FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFilter(opt.id);
                      setPage(1);
                    }}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-mono font-bold transition-colors cursor-pointer ${
                      active
                        ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {opt.label} ({counts[opt.id]})
                  </button>
                );
              })}
            </div>
            <div className="relative sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search player or court…"
                aria-label="Filter activity by player or court"
                className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching activity found.
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
                          {e.subject_ids.length > 0 && (
                            <div className="mt-0.5 flex items-center -space-x-1.5 shrink-0">
                              {e.subject_ids.slice(0, 4).map((pid, idx) => (
                                <PlayerAvatar
                                  key={`${e.id}-${pid}-${idx}`}
                                  name={names[pid] || "Player"}
                                  avatarUrl={avatars?.[pid]}
                                  size="xs"
                                  className="ring-2 ring-white dark:ring-slate-900"
                                />
                              ))}
                            </div>
                          )}
                          <span
                            className={`min-w-0 flex-1 text-sm leading-6 ${
                              strong
                                ? "font-semibold text-slate-900 dark:text-slate-100"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {textById.get(e.id) ?? describeEvent(e, names, viewerId, matchTeams, courtNames)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span className="px-2 text-xs font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
