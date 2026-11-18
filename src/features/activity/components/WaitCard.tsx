"use client";

import { useMemo, useState } from "react";
import { formatPHTTime } from "@/lib/timezone";
import { buildMatchTeams, describeEvent } from "@/features/activity/utils/describeEvent";
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
  gamesPlayed,
}: {
  position: number | null;
  courtsInPlay: number;
  avgGameMinutes: number | null;
  events: SessionEvent[];
  names: Record<string, string>;
  viewerId: string;
  gamesPlayed?: number;
}) {
  const [open, setOpen] = useState(false);
  const wait = estimateWait({ position, courtsInPlay, avgGameMinutes });
  const mine = eventsAffecting(events, viewerId);
  const matchTeams = useMemo(() => buildMatchTeams(events), [events]);
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
        className="min-h-11 inline-flex items-center text-sm font-semibold text-slate-600 dark:text-slate-300 underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
      >
        {open ? "Hide" : "Why the wait?"}
      </button>
      {open && (
        <div className="mt-1 space-y-2 text-sm">
          <p className="text-slate-700 dark:text-slate-300">{summary}</p>
          {gamesPlayed !== undefined && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              You&apos;ve played{" "}
              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">{gamesPlayed}</span>{" "}
              {gamesPlayed === 1 ? "game" : "games"} this session.
            </p>
          )}
          {mine.length > 0 && (
            <ul className="space-y-1">
              {mine.map((e) => (
                <li key={e.id} className="flex gap-2 text-slate-600 dark:text-slate-400">
                  <time dateTime={e.created_at} className="w-16 shrink-0 font-mono tabular-nums text-xs leading-5">
                    {formatPHTTime(e.created_at)}
                  </time>
                  {describeEvent(e, names, viewerId, matchTeams)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
