"use client";

import { useState } from "react";
import { formatPHTTime } from "@/lib/timezone";
import { describeEvent } from "@/features/activity/utils/describeEvent";
import { estimateWait, eventsAffecting } from "@/features/activity/utils/waitEstimate";
import type { SessionEvent } from "@/types";

/** "Why the wait?": the player's place, what's ahead of them, and what changed for them. */
export function WaitCard({
  position,
  courtsInPlay,
  avgGameMinutes,
  events,
  names,
  viewerId,
}: {
  position: number | null;
  courtsInPlay: number;
  avgGameMinutes: number | null;
  events: SessionEvent[];
  names: Record<string, string>;
  viewerId: string;
}) {
  const [open, setOpen] = useState(false);
  const wait = estimateWait({ position, courtsInPlay, avgGameMinutes });
  const mine = eventsAffecting(events, viewerId);
  const perGame = avgGameMinutes ?? 12;

  const summary = wait.nextGame
    ? "You're in the next game."
    : `You're #${position}. ${wait.groupsAhead} ${wait.groupsAhead === 1 ? "group" : "groups"} ahead of you, ` +
      `${courtsInPlay} ${courtsInPlay === 1 ? "court" : "courts"} in play, games are averaging ${perGame} min` +
      `${avgGameMinutes === null ? " (estimate)" : ""}, so about ${wait.minutes} min.`;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="h-9 text-sm font-semibold text-slate-600 dark:text-slate-300 underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
      >
        {open ? "Hide" : "Why the wait?"}
      </button>
      {open && (
        <div className="mt-1 space-y-2 text-sm">
          <p className="text-slate-700 dark:text-slate-300">{summary}</p>
          {mine.length > 0 && (
            <ul className="space-y-1">
              {mine.map((e) => (
                <li key={e.id} className="flex gap-2 text-slate-600 dark:text-slate-400">
                  <time dateTime={e.created_at} className="w-16 shrink-0 font-mono tabular-nums text-xs leading-5">
                    {formatPHTTime(e.created_at)}
                  </time>
                  {describeEvent(e, names, viewerId)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
