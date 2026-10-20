"use client";

import { useEffect, useState, useTransition } from "react";
import { getAdminAudit } from "@/features/activity/api/activityActions";
import { describeEvent } from "@/features/activity/utils/describeEvent";
import { formatPHTDate, formatPHTTime } from "@/lib/timezone";
import type { AdminAuditEvent, Session, SessionEventType } from "@/types";

const FILTERS: { id: string; label: string; types: SessionEventType[] | null }[] = [
  { id: "all", label: "All", types: null },
  { id: "games", label: "Games & results", types: ["game_started", "game_result", "result_corrected"] },
  {
    id: "queue",
    label: "Queue changes",
    types: [
      "joined_queue",
      "left_queue",
      "players_added",
      "break_started",
      "break_ended",
      "moved_in_queue",
      "removed_from_queue",
      "players_swapped",
      "no_show_swapped",
    ],
  },
  {
    id: "admin",
    label: "Corrections & swaps",
    types: ["result_corrected", "no_show_swapped", "players_swapped", "moved_in_queue", "removed_from_queue"],
  },
];

/** Admin-only audit trail: every session event with who did it. */
export function AdminAuditView({ sessions, names }: { sessions: Session[]; names: Record<string, string> }) {
  const sorted = [...sessions].sort((a, b) => b.start_time.localeCompare(a.start_time));
  const defaultSession = sorted.find((s) => s.status === "active") ?? sorted[0];
  const [sessionId, setSessionId] = useState<string>(defaultSession?.id ?? "");
  const [filterId, setFilterId] = useState("all");
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const types = FILTERS.find((f) => f.id === filterId)?.types ?? undefined;
    startTransition(async () => {
      const rows = await getAdminAudit({ sessionId: sessionId || undefined, types: types ?? undefined });
      setEvents(rows);
      setLoaded(true);
    });
  }, [sessionId, filterId]);

  return (
    <section aria-labelledby="audit-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="audit-heading" className="text-lg font-bold text-slate-900 dark:text-slate-100">Activity</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Everything that happened in a session, and who did it. Players see the same feed with admins shown as
          &quot;An admin&quot;.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:flex-1">
          Session
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
          >
            <option value="">All sessions</option>
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}, {formatPHTDate(s.start_time)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Show
          <select
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!loaded || (isPending && events.length === 0) ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading activity…</p>
      ) : events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-sm text-slate-500 dark:text-slate-400">
          No activity for this selection.
        </p>
      ) : (
        <ol
          aria-busy={isPending}
          className={`divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 ${
            isPending ? "opacity-60" : ""
          }`}
        >
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:gap-3">
              <time dateTime={e.created_at} className="shrink-0 font-mono tabular-nums text-xs leading-5 text-slate-500 dark:text-slate-400 sm:w-32">
                {formatPHTDate(e.created_at)} {formatPHTTime(e.created_at)}
              </time>
              <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
                {describeEvent({ ...e, actor_name: e.actor_role === "admin" ? e.actor_name : null }, names)}
                {!sessionId && e.session_title ? (
                  <span className="text-slate-500 dark:text-slate-400"> ({e.session_title})</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {e.actor_role === "system" ? "Automatic" : e.actor_name ? `By ${e.actor_name}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
