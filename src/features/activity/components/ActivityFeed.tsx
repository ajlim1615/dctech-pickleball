"use client";

import { useState } from "react";
import { formatPHTTime } from "@/lib/timezone";
import { describeEvent } from "@/features/activity/utils/describeEvent";
import type { SessionEvent } from "@/types";

const PAGE = 15;

/** What's happened in this session, newest first. */
export function ActivityFeed({
  events,
  names,
  viewerId,
}: {
  events: SessionEvent[];
  names: Record<string, string>;
  viewerId?: string;
}) {
  const [shown, setShown] = useState(PAGE);
  const visible = events.slice(0, shown);

  return (
    <section aria-labelledby="activity-heading" className="space-y-3">
      <h2 id="activity-heading" className="text-lg font-bold text-slate-900 dark:text-slate-100">
        Activity
      </h2>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-sm text-slate-500 dark:text-slate-400">
          Nothing has happened yet.
        </p>
      ) : (
        <ol className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          {visible.map((e) => (
            <li key={e.id} className="flex gap-3 px-4 py-2.5 text-sm">
              <time
                dateTime={e.created_at}
                className="w-16 shrink-0 font-mono tabular-nums text-xs leading-5 text-slate-500 dark:text-slate-400"
              >
                {formatPHTTime(e.created_at)}
              </time>
              <span
                className={
                  e.subject_ids.includes(viewerId ?? "")
                    ? "font-medium text-slate-900 dark:text-slate-100"
                    : "text-slate-700 dark:text-slate-300"
                }
              >
                {describeEvent(e, names, viewerId)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {events.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="h-11 rounded-md px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
        >
          Show more
        </button>
      )}
    </section>
  );
}
