"use client";

import { useState } from "react";
import {
  Trophy,
  Award,
  Medal,
  Flame,
  Search,
  ArrowUpDown,
  History,
  Users,
  Calendar,
  CheckCircle2,
  Sparkles,
  Share2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRating } from "@/lib/utils";
import { ShareLeaderboardModal } from "./ShareLeaderboardModal";
import type { SessionRankedPlayer } from "../utils/sessionLeaderboard";

interface SessionLeaderboardProps {
  initialRankings?: SessionRankedPlayer[];
  matches?: any[];
  sessionTitle?: string;
  isSessionActive?: boolean;
}

type SortField = "rank" | "name" | "rating" | "games" | "won" | "win_rate" | "point_diff";
type SortOrder = "asc" | "desc";

export function SessionLeaderboard({
  initialRankings = [],
  matches = [],
  sessionTitle = "Session",
  isSessionActive = false,
}: SessionLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<"standings" | "matches">("standings");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showShareModal, setShowShareModal] = useState(false);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "name" || field === "rank" ? "asc" : "desc");
    }
  }

  const filtered = initialRankings.filter((r) =>
    (r.full_name || r.display_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "rank":
        comparison = (a.rank || 0) - (b.rank || 0);
        break;
      case "name":
        comparison = (a.full_name || a.display_name || "").localeCompare(
          b.full_name || b.display_name || ""
        );
        break;
      case "rating":
        comparison = Number(a.skill_rating || 0) - Number(b.skill_rating || 0);
        break;
      case "games":
        comparison = (a.games_played || 0) - (b.games_played || 0);
        break;
      case "won":
        comparison = (a.games_won || 0) - (b.games_won || 0);
        break;
      case "win_rate":
        comparison = (a.win_rate || 0) - (b.win_rate || 0);
        break;
      case "point_diff":
        comparison = (a.point_diff || 0) - (b.point_diff || 0);
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const top3 = initialRankings.filter((p) => p.games_played > 0).slice(0, 3);
  const completedMatchesCount = matches.filter(
    (m) =>
      m.status === "completed" ||
      m.winning_team ||
      (m.team_a_score !== null &&
        m.team_b_score !== null &&
        (Number(m.team_a_score) > 0 || Number(m.team_b_score) > 0))
  ).length;
  const derivedGamesCount = Math.ceil(
    initialRankings.reduce((sum, p) => sum + (p.games_played || 0), 0) / 4
  );
  const totalGamesPlayed = Math.max(completedMatchesCount, derivedGamesCount, matches.length);

  return (
    <div className="space-y-6">
      {/* Tab Switcher & Stats Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("standings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "standings"
                ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Trophy className="h-4 w-4" />
            Session Standings ({initialRankings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("matches")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "matches"
                ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <History className="h-4 w-4" />
            Match Logs ({totalGamesPlayed})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="volt"
            size="sm"
            onClick={() => setShowShareModal(true)}
            className="font-bold text-xs font-mono shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share Leaderboard</span>
          </Button>
        </div>
      </div>

      {activeTab === "standings" ? (
        <div className="space-y-6">
          {/* Top 3 Podium Cards (when games have been played) */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3.map((player, idx) => {
                const medalColors = [
                  "border-amber-400/60 bg-gradient-to-b from-amber-500/10 to-amber-500/5 dark:border-amber-400/40 text-amber-600 dark:text-amber-400",
                  "border-slate-300 bg-gradient-to-b from-slate-200/40 to-slate-200/10 dark:border-slate-700 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300",
                  "border-amber-700/40 bg-gradient-to-b from-amber-700/10 to-amber-700/5 dark:border-amber-700/30 text-amber-700 dark:text-amber-500",
                ];
                const medalTitles = ["1ST PLACE • GOLD", "2ND PLACE • SILVER", "3RD PLACE • BRONZE"];
                const medalIcons = ["🥇", "🥈", "🥉"];

                return (
                  <Card
                    key={player.id}
                    className={`border-2 p-4 space-y-3 relative overflow-hidden transition-all shadow-xs ${medalColors[idx]}`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-mono font-bold">
                        {medalIcons[idx]} {medalTitles[idx]}
                      </Badge>
                      <span className="text-xs font-mono font-bold">
                        DUPR {formatRating(player.skill_rating)}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {player.full_name || player.display_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>{player.games_won}W - {player.games_lost}L</span>
                        <span>•</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {player.win_rate}% Win Rate
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-black/5 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Point Differential:</span>
                      <span
                        className={`font-bold ${
                          player.point_diff > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : player.point_diff < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-500"
                        }`}
                      >
                        {player.point_diff > 0 ? `+${player.point_diff}` : player.point_diff}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Standings Filter & Search */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search session player..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <span className="text-xs font-mono text-slate-400">
              Showing {sorted.length} players
            </span>
          </div>

          {/* Standings Table */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-[11px]">
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors w-16"
                      onClick={() => toggleSort("rank")}
                    >
                      <div className="flex items-center gap-1">
                        <span>#</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        <span>PLAYER</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-right"
                      onClick={() => toggleSort("rating")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>DUPR</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-right"
                      onClick={() => toggleSort("games")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>GP</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-right"
                      onClick={() => toggleSort("won")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>W - L</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-right"
                      onClick={() => toggleSort("win_rate")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>WIN %</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors text-right"
                      onClick={() => toggleSort("point_diff")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>+/- DIFF</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No checked-in players or match records found for this session.
                      </td>
                    </tr>
                  ) : (
                    sorted.map((player) => {
                      const isPodium = player.rank <= 3 && player.games_played > 0;
                      return (
                        <tr
                          key={player.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                            {isPodium ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 text-xs">
                                {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : "🥉"}
                              </span>
                            ) : (
                              `#${player.rank}`
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {player.full_name || player.display_name}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                            {formatRating(player.skill_rating)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                            {player.games_played}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                            {player.games_won} - {player.games_lost}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {player.games_played > 0 ? `${player.win_rate}%` : "-"}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              player.point_diff > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : player.point_diff < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-400"
                            }`}
                          >
                            {player.games_played > 0
                              ? player.point_diff > 0
                                ? `+${player.point_diff}`
                                : player.point_diff
                              : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* Match History Log for this Session */
        <div className="space-y-4">
          {matches.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 text-center font-mono text-xs text-slate-500">
              No matches recorded for this session yet. Matches played on facility courts will appear here in real time.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((m) => {
                const isCompleted = m.status === "completed";
                const teamAPlayers = (m.players || [])
                  .filter((p: any) => p.team === "team_a")
                  .map((p: any) => p.player?.full_name || p.player?.display_name || "Player");
                const teamBPlayers = (m.players || [])
                  .filter((p: any) => p.team === "team_b")
                  .map((p: any) => p.player?.full_name || p.player?.display_name || "Player");

                const teamAWon = m.winning_team === "team_a" || (m.team_a_score > m.team_b_score);
                const teamBWon = m.winning_team === "team_b" || (m.team_b_score > m.team_a_score);

                return (
                  <Card
                    key={m.id}
                    className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-3 font-mono shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {m.court?.name || "Court"} • {m.format?.toUpperCase() || "DOUBLES"}
                      </span>
                      <Badge
                        variant={isCompleted ? "outline" : "volt"}
                        className="text-[9px] uppercase tracking-wider font-bold"
                      >
                        {isCompleted ? "FINAL" : "IN PLAY"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-5 items-center gap-2 text-xs">
                      {/* Team A */}
                      <div className={`col-span-2 space-y-0.5 ${teamAWon ? "font-bold text-slate-900 dark:text-slate-100" : "text-slate-500"}`}>
                        {teamAPlayers.map((name: string, i: number) => (
                          <div key={i} className="truncate">{name}</div>
                        ))}
                      </div>

                      {/* Score */}
                      <div className="col-span-1 text-center font-extrabold text-sm flex items-center justify-center gap-1.5">
                        <span className={teamAWon ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                          {m.team_a_score ?? 0}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">:</span>
                        <span className={teamBWon ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                          {m.team_b_score ?? 0}
                        </span>
                      </div>

                      {/* Team B */}
                      <div className={`col-span-2 text-right space-y-0.5 ${teamBWon ? "font-bold text-slate-900 dark:text-slate-100" : "text-slate-500"}`}>
                        {teamBPlayers.map((name: string, i: number) => (
                          <div key={i} className="truncate">{name}</div>
                        ))}
                      </div>
                    </div>

                    {m.started_at && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 flex items-center justify-between">
                        <span>{new Date(m.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                        {teamAWon && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Team 1 Victory</span>}
                        {teamBWon && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Team 2 Victory</span>}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Share Leaderboard Modal */}
      <ShareLeaderboardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        rankings={initialRankings}
        sessionTitle={sessionTitle}
        totalGames={totalGamesPlayed}
      />
    </div>
  );
}
