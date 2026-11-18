"use client";

import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRating } from "@/lib/utils";
import type { RankedPlayer } from "../api/rankingActions";

export type SortField = "rank" | "name" | "rating" | "games" | "won" | "win_rate";
export type SortOrder = "asc" | "desc";

const SORT_LABELS: Record<SortField, string> = {
  rank: "Rank",
  name: "Name",
  rating: "Rating",
  games: "Games",
  won: "Wins",
  win_rate: "Win rate",
};

interface RankingsLadderProps {
  rows: RankedPlayer[];
  search: string;
  /** Shown when there are no rows and no search is active. */
  emptyMessage: string;
  sortField: SortField;
  sortOrder: SortOrder;
  onToggleSort: (field: SortField) => void;
  onView: (p: RankedPlayer) => void;
  onPhoto: (p: RankedPlayer) => void;
}

export function RankingsLadder({ rows, search, emptyMessage, sortField, sortOrder, onToggleSort, onView, onPhoto }: RankingsLadderProps) {
  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-emerald-600 dark:text-[#d4e938]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-600 dark:text-[#d4e938]" />
    );
  }

  function sortHeader(field: SortField, align: "left" | "center" | "right" = "left") {
    return (
      <button
        type="button"
        onClick={() => onToggleSort(field)}
        aria-label={`Sort by ${SORT_LABELS[field]}`}
        className={`group inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer ${
          align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""
        } ${sortField === field ? "text-slate-900 dark:text-slate-100" : ""}`}
      >
        {SORT_LABELS[field]}
        {renderSortIcon(field)}
      </button>
    );
  }

  return (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden shadow-sm">
              {/* Column headers (wider screens) */}
              <div className="hidden sm:grid grid-cols-[64px_minmax(0,1fr)_88px_72px_72px_80px_88px] items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-500 dark:text-slate-400 select-none">
                {sortHeader("rank")}
                {sortHeader("name")}
                {sortHeader("rating", "center")}
                {sortHeader("games", "center")}
                {sortHeader("won", "center")}
                {sortHeader("win_rate", "right")}
                <span className="sr-only">Actions</span>
              </div>

              {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {search.trim() ? <>No players match &quot;{search}&quot;. Try a first or last name.</> : emptyMessage}
                </p>
              ) : (
                <ol className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {rows.map((player) => {
                    const name = player.full_name || player.display_name || "Player";
                    const losses = Math.max(0, (player.games_played || 0) - (player.games_won || 0));
                    const medal =
                      player.rank === 1
                        ? "text-[#c8961e] dark:text-[#f5c84c]"
                        : player.rank === 2
                          ? "text-slate-500 dark:text-slate-300"
                          : player.rank === 3
                            ? "text-[#a35d28] dark:text-[#d98b4a]"
                            : "text-slate-400 dark:text-slate-500";
                    return (
                      <li
                        key={player.id}
                        className="deferred-list-row grid grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[64px_minmax(0,1fr)_88px_72px_72px_80px_88px] items-center gap-2 px-3 sm:px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <span
                          className={`font-mono text-sm font-black tabular-nums leading-tight ${medal}`}
                          title={player.tied ? `Tied for #${player.rank}` : undefined}
                        >
                          {player.rank === null ? "New" : `#${player.rank}`}
                          {player.tied && (
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Tied</span>
                          )}
                        </span>

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
                              <img src={player.avatar_url} alt="" width={36} height={36} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            </button>
                          ) : (
                            <div className="h-9 w-9 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
                              {name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</div>
                            {/* Phones: the numbers ride under the name */}
                            <div className="sm:hidden font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {player.games_won}W {losses}L · {player.win_rate}%
                            </div>
                          </div>
                        </div>

                        {/* Rating: on phones it sits at the end with the View button */}
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
                        <span className="hidden sm:block text-center font-mono text-sm tabular-nums text-slate-700 dark:text-slate-300">{player.games_played}</span>
                        <span className="hidden sm:block text-center font-mono text-sm tabular-nums text-slate-700 dark:text-slate-300">{player.games_won}</span>
                        <span className="hidden sm:block text-right font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{player.win_rate}%</span>
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
                </ol>
              )}
            </div>
  );
}
