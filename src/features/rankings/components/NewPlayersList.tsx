"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRating } from "@/lib/utils";
import type { RankedPlayer } from "../api/rankingActions";

interface NewPlayersListProps {
  players: RankedPlayer[];
  onView: (p: RankedPlayer) => void;
  onPhoto: (p: RankedPlayer) => void;
}

/** Players still earning their first ranked games. They have a rating but no rank yet. */
export function NewPlayersList({ players, onView, onPhoto }: NewPlayersListProps) {
  if (players.length === 0) return null;

  return (
    <section aria-labelledby="new-players-heading" className="space-y-3">
      <h2 id="new-players-heading" className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
        New players
      </h2>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden shadow-sm">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {players.map((player) => {
            const name = player.full_name || player.display_name || "Player";
            return (
              <li
                key={player.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_88px_88px] items-center gap-2 px-3 sm:px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {player.avatar_url ? (
                    <button
                      type="button"
                      onClick={() => onPhoto(player)}
                      title="View photo"
                      aria-label={`View ${name}'s photo`}
                      className="h-9 w-9 rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 cursor-zoom-in hover:ring-2 hover:ring-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none transition"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <div className="h-9 w-9 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {player.gamesToQualify} more ranked {player.gamesToQualify === 1 ? "game" : "games"}
                    </div>
                  </div>
                </div>

                <span className="sm:text-center font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 flex items-center justify-end sm:justify-center gap-2">
                  {formatRating(player.skill_rating)}
                  <button
                    type="button"
                    onClick={() => onView(player)}
                    aria-label={`View ${name}'s stats`}
                    className="sm:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                  </button>
                </span>
                <span className="hidden sm:flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(player)}
                    className="text-xs text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" aria-hidden /> View
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
