"use client";

import { useState } from "react";
import { Trophy, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRating } from "@/lib/utils";
import type { RankedPlayer } from "../api/rankingActions";

interface LeaderboardTableProps {
  initialRankings?: RankedPlayer[];
}

export function LeaderboardTable({ initialRankings = [] }: LeaderboardTableProps) {
  const [search, setSearch] = useState("");
  const rankings: RankedPlayer[] = initialRankings;

  const filtered = rankings.filter((r) =>
    (r.full_name || r.display_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Trophy className="h-7 w-7 text-emerald-600 dark:text-[#d4e938]" />
            Player Rankings & Stats
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            DCTECH employee leaderboard based on DUPR skill rating and win percentage
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-none shadow-xs"
          />
        </div>
      </div>

      {/* Content or Empty State */}
      {rankings.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-12 text-center space-y-3 font-mono text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          <Trophy className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto" />
          <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">No Match Ratings Recorded Yet</p>
          <p className="text-slate-500 max-w-sm mx-auto">
            When employees record and finish games in an open-play session, rankings and DUPR standings will appear here.
          </p>
        </Card>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {rankings.slice(0, 3).map((topPlayer, idx) => {
              const medals = ["🥇 GOLD", "🥈 SILVER", "🥉 BRONZE"];
              const borderClasses = [
                "border-lime-500/50 dark:border-[#d4e938]/40 bg-gradient-to-b from-lime-50/50 dark:from-slate-900 to-white dark:to-slate-950",
                "border-slate-300 dark:border-slate-600 bg-gradient-to-b from-slate-50 dark:from-slate-900 to-white dark:to-slate-950",
                "border-amber-400/50 dark:border-amber-700/40 bg-gradient-to-b from-amber-50/50 dark:from-slate-900 to-white dark:to-slate-950",
              ];

              return (
                <Card key={topPlayer.id} className={`border-2 p-5 text-center space-y-2 relative overflow-hidden shadow-sm ${borderClasses[idx]}`}>
                  <div className="text-xs font-mono font-bold tracking-wider text-emerald-700 dark:text-[#d4e938]">
                    {medals[idx]}
                  </div>

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 font-mono text-lg font-bold text-slate-800 dark:text-slate-100 shadow-xs">
                    {topPlayer.full_name?.slice(0, 2).toUpperCase() || "DC"}
                  </div>

                  <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {topPlayer.full_name || topPlayer.display_name}
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Badge variant="volt" className="text-xs font-mono font-bold">
                      ★ DUPR {formatRating(topPlayer.skill_rating)}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <div>
                      <span className="text-[10px] block">WINS</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{topPlayer.games_won}</span>
                    </div>
                    <div>
                      <span className="text-[10px] block">WIN RATE</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{topPlayer.win_rate}%</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Full Leaderboard Table */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">Rank</th>
                    <th className="px-5 py-3.5 font-bold">Player</th>
                    <th className="px-5 py-3.5 font-bold text-center">DUPR Rating</th>
                    <th className="px-5 py-3.5 font-bold text-center">Games</th>
                    <th className="px-5 py-3.5 font-bold text-center">Won</th>
                    <th className="px-5 py-3.5 font-bold text-right">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filtered.map((player) => (
                    <tr
                      key={player.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-500 dark:text-slate-400">
                        #{player.rank}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-sans font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {player.full_name || player.display_name}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {player.email}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge variant="default" className="font-mono text-xs font-bold">
                          {formatRating(player.skill_rating)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-700 dark:text-slate-300">
                        {player.games_played}
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-700 dark:text-slate-300">
                        {player.games_won}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {player.win_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
