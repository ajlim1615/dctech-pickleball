"use client";

import { useState } from "react";
import {
  Trophy,
  Search,
  User,
  Eye,
  X,
  CheckCircle2,
  Loader2,
  Award,
  Calendar,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRating } from "@/lib/utils";
import { getPlayerMatchHistory } from "@/features/players/api/playerActions";
import type { RankedPlayer } from "../api/rankingActions";

interface LeaderboardTableProps {
  initialRankings?: RankedPlayer[];
}

type SortField = "rank" | "name" | "rating" | "games" | "won" | "win_rate";
type SortOrder = "asc" | "desc";

export function LeaderboardTable({ initialRankings = [] }: LeaderboardTableProps) {
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);
  const [playerMatches, setPlayerMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const rankings: RankedPlayer[] = initialRankings;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "name" || field === "rank" ? "asc" : "desc");
    }
  }

  const filtered = rankings.filter((r) =>
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
        if (comparison === 0) {
          comparison = (a.games_won || 0) - (b.games_won || 0);
        }
        break;
      case "won":
        comparison = (a.games_won || 0) - (b.games_won || 0);
        if (comparison === 0) {
          comparison = (a.games_played || 0) - (b.games_played || 0);
        }
        break;
      case "win_rate":
        comparison = (a.win_rate || 0) - (b.win_rate || 0);
        if (comparison === 0) {
          comparison = (a.games_won || 0) - (b.games_won || 0);
        }
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  async function handleViewPlayer(player: RankedPlayer) {
    setSelectedPlayer(player);
    setIsLoadingMatches(true);
    setPlayerMatches([]);
    try {
      const history = await getPlayerMatchHistory(player.id);
      setPlayerMatches(history || []);
    } catch (err) {
      console.error("Error fetching player match history:", err);
    } finally {
      setIsLoadingMatches(false);
    }
  }

  // Format matches for player detail view
  const formattedMatches = playerMatches.map((item: any) => {
    if (item.result && item.score) return item;

    const match = item.match || item;
    const playerTeam = item.team;
    let isWon = false;
    if (match.winning_team) {
      isWon = match.winning_team === playerTeam;
    } else if (match.team_a_score !== undefined && match.team_b_score !== undefined) {
      const winningSide = match.team_a_score > match.team_b_score ? "team_a" : match.team_b_score > match.team_a_score ? "team_b" : "tie";
      isWon = winningSide === playerTeam;
    }
    const isTie = match.winning_team === "tie";
    const isInProgress = match.status === "in_progress";

    const result = isInProgress ? "LIVE" : isTie ? "TIE" : isWon ? "WIN" : "LOSS";
    const courtName = (match.court as any)?.name || (typeof match.court === "string" ? match.court : "Court");
    const formatLabel = match.format === "doubles" ? "Doubles (2v2)" : "Singles (1v1)";
    const sessionTitle = item.sessionTitle || "Open Play Session";
    const partner = item.partner;
    const opponents = item.opponents;
    const dateSource = match.ended_at || match.started_at || item.created_at;
    const dateLabel = dateSource
      ? new Date(dateSource).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "Recent";
    const scoreLabel = `${match.team_a_score ?? 0} - ${match.team_b_score ?? 0}`;

    return {
      result,
      court: courtName,
      format: formatLabel,
      sessionTitle,
      partner,
      opponents,
      date: dateLabel,
      type: sessionTitle,
      score: scoreLabel,
    };
  });

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Employee Rankings
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            Official DUPR Dynamic Ratings & Performance Standings
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-4 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-2xs"
          />
        </div>
      </div>

      {rankings.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-12 text-center shadow-sm">
          <Trophy className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            No rankings recorded yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 max-w-md mx-auto">
            Rankings will update as soon as matches are played and scores are verified.
          </p>
        </Card>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rankings.slice(0, 3).map((topPlayer, idx) => {
              const medals = ["🥇 GOLD", "🥈 SILVER", "🥉 BRONZE"];
              const borders = [
                "border-amber-400/50 bg-amber-50/20 dark:bg-amber-950/20 shadow-amber-500/5",
                "border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50",
                "border-amber-700/30 bg-amber-900/10 dark:bg-amber-950/10",
              ];

              return (
                <Card
                  key={topPlayer.id}
                  className={`p-5 text-center space-y-3 relative overflow-hidden transition-all hover:scale-[1.02] shadow-sm ${borders[idx]}`}
                >
                  <div className="text-xs font-mono font-bold tracking-wider text-emerald-700 dark:text-[#d4e938]">
                    {medals[idx]}
                  </div>

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 font-mono text-lg font-bold text-slate-800 dark:text-slate-100 shadow-xs overflow-hidden">
                    {topPlayer.avatar_url ? (
                      <img
                        src={topPlayer.avatar_url}
                        alt={topPlayer.full_name || "Avatar"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      topPlayer.full_name?.slice(0, 2).toUpperCase() || "DC"
                    )}
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

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPlayer(topPlayer)}
                      className="w-full text-xs font-mono text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> View Player Stats
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Full Leaderboard Table with Interactive Column Sorting */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] text-slate-500 dark:text-slate-400 uppercase select-none">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort("rank")}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                      >
                        <span>Rank</span>
                        {renderSortIcon("rank")}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 font-bold">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                      >
                        <span>Player</span>
                        {renderSortIcon("name")}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 font-bold text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("rating")}
                        className="flex items-center justify-center gap-1.5 mx-auto hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                      >
                        <span>DUPR Rating</span>
                        {renderSortIcon("rating")}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 font-bold text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("games")}
                        className="flex items-center justify-center gap-1.5 mx-auto hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                      >
                        <span>Games</span>
                        {renderSortIcon("games")}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 font-bold text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("won")}
                        className="flex items-center justify-center gap-1.5 mx-auto hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                      >
                        <span>Won</span>
                        {renderSortIcon("won")}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 font-bold text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("win_rate")}
                        className="flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 dark:hover:text-slate-100 group transition-colors"
                      >
                        <span>Win Rate</span>
                        {renderSortIcon("win_rate")}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {sorted.map((player) => (
                    <tr
                      key={player.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-500 dark:text-slate-400">
                        #{player.rank}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 overflow-hidden shrink-0">
                            {player.avatar_url ? (
                              <img
                                src={player.avatar_url}
                                alt={player.full_name || "Avatar"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              player.full_name?.slice(0, 2).toUpperCase() || "DC"
                            )}
                          </div>
                          <div>
                            <div className="font-sans font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {player.full_name || player.display_name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              {player.email}
                            </div>
                          </div>
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
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPlayer(player)}
                          className="text-xs text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* View Player Stats & History Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header: Profile Picture, Name, Email, Rank */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-slate-100 dark:bg-slate-950 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 shadow-md">
                  {selectedPlayer.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedPlayer.avatar_url}
                      alt={selectedPlayer.full_name || "Avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    selectedPlayer.full_name?.slice(0, 2).toUpperCase() || "DC"
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                      {selectedPlayer.full_name || selectedPlayer.display_name}
                    </h2>
                    <Badge variant="volt" className="text-xs font-mono font-bold">
                      #{selectedPlayer.rank} Rank
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {selectedPlayer.email}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                      {selectedPlayer.role}
                    </Badge>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Verified DCTECH Player
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 4-Card Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-center shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase">GAMES PLAYED</div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedPlayer.games_played}
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-center shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase">GAMES WON</div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {selectedPlayer.games_won}
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-center shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase">WIN RATE</div>
                <div className="text-2xl font-extrabold text-emerald-700 dark:text-[#d4e938] mt-0.5">
                  {selectedPlayer.win_rate}%
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-center shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase">SKILL RATING</div>
                <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5 font-mono">
                  {formatRating(selectedPlayer.skill_rating)}
                </div>
              </Card>
            </div>

            {/* Recent Match History Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-emerald-500" />
                  Recent Match History
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {formattedMatches.length} matches
                </span>
              </div>

              {isLoadingMatches ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400 space-y-2">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-emerald-500" />
                  <p>Loading match history...</p>
                </div>
              ) : formattedMatches.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400 space-y-1.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Trophy className="h-5 w-5 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="text-slate-700 dark:text-slate-300 font-semibold">No Logged Matches</p>
                  <p className="text-slate-500 text-[11px]">This player has not finished any recorded open-play matches yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800/60 max-h-80 overflow-y-auto pr-1">
                  {formattedMatches.map((m, idx) => (
                    <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold mt-0.5 ${
                            m.result === "WIN"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : m.result === "LIVE"
                              ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {m.result}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {m.court} • {m.format}
                            </span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono text-slate-600 dark:text-slate-400">
                              {m.sessionTitle}
                            </Badge>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              {m.date}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
                            {m.partner && (
                              <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">🤝 Partner:</span>
                                <span className="font-bold">{m.partner}</span>
                              </div>
                            )}
                            {m.opponents && (
                              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                <span className="font-semibold text-slate-400">⚔️ vs:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-200">{m.opponents}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800/60 font-mono shrink-0 pl-10 sm:pl-0">
                        <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {m.score}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPlayer(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
