"use client";

import { useMemo, useState } from "react";
import { Sparkles, Search } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { WaitTimer } from "@/components/ui/wait-timer";
import type { QueueEntryWithPlayer } from "@/types";

export function playerName(p?: { full_name?: string | null; display_name?: string | null } | null) {
  return p?.full_name || p?.display_name || "Player";
}

/**
 * Pick someone from the waiting line: a search box and the list, oldest first.
 * `onAutoPick` adds an "Auto-pick best match" button on top.
 */
export function PlayerPickerSheet({
  title,
  subtitle,
  candidates,
  gamesPlayed,
  showWait = true,
  onPick,
  onAutoPick,
  onClose,
}: {
  title: string;
  subtitle?: string;
  candidates: QueueEntryWithPlayer[];
  gamesPlayed?: Record<string, number>;
  showWait?: boolean;
  onPick: (playerId: string, name: string) => void;
  onAutoPick?: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .toSorted((a, b) => (a.joined_at < b.joined_at ? -1 : 1))
      .filter((c) => !q || playerName(c.player).toLowerCase().includes(q));
  }, [candidates, query]);

  return (
    <Sheet
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          Cancel
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {onAutoPick && (
          <button
            type="button"
            onClick={onAutoPick}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <Sparkles className="h-4 w-4" /> Auto-pick best match
          </button>
        )}
        <label className="relative block shrink-0">
          <span className="sr-only">Search players</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players…"
            className="min-h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-500"
          />
        </label>
        <ul className="space-y-1.5">
          {shown.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No one waiting matches.</li>}
          {shown.map((c) => {
            const played = gamesPlayed?.[c.player_id] ?? 0;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c.player_id, playerName(c.player))}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-left cursor-pointer hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-500"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{playerName(c.player)}</span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {c.player?.skill_rating != null && (
                        <span className="font-mono tabular-nums">{Number(c.player.skill_rating).toFixed(1)}</span>
                      )}
                      {c.player?.skill_rating != null && <span aria-hidden>·</span>}
                      <span className="tabular-nums">
                        {played} {played === 1 ? "game" : "games"}
                      </span>
                      {showWait && c.joined_at && (
                        <>
                          <span aria-hidden>·</span>
                          <WaitTimer since={c.joined_at} prefix="waiting " />
                        </>
                      )}
                      {c.group_id && (
                        <>
                          <span aria-hidden>·</span>
                          <span>paired</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
