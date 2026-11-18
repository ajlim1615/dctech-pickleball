"use client";

import { useState, type ReactNode } from "react";
import {
  Trophy,
  Award,
  Medal,
  Flame,
  Search,
  ArrowUpDown,
  History,
  Activity,
  Users,
  Calendar,
  CheckCircle2,
  Sparkles,
  Share2,
  FileSpreadsheet,
} from "lucide-react";
import { getSessionExport } from "../api/sessionExportActions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { formatRating } from "@/lib/utils";
import { formatPHTTime } from "@/lib/timezone";
import { formatMatchDuration } from "@/lib/duration";
import { ShareLeaderboardModal } from "./ShareLeaderboardModal";
import { MIN_QUALIFIED_GAMES, type SessionRankedPlayer } from "../utils/sessionLeaderboard";
import { isResultOnlyScore, type ScoringRule } from "@/features/matches/utils/scoring";
import { EditResultModal, type EditableMatch } from "@/features/matches/components/EditResultModal";

interface SessionLeaderboardProps {
  initialRankings?: SessionRankedPlayer[];
  matches?: any[];
  sessionTitle?: string;
  isSessionActive?: boolean;
  /** Admins can correct finished games. */
  isAdmin?: boolean;
  rule?: ScoringRule;
  /** Needed for the admin's Excel export. */
  sessionId?: string;
  /** Session-specific court names keyed by court_id. */
  courtNames?: Record<string, string>;
  /** Fallback court names keyed by match_id (for deleted courts where match.court_id is null). */
  matchCourtNames?: Record<string, string>;
  /** Rendered in the Activity tab beside Match Logs. */
  activityFeed?: ReactNode;
  activityCount?: number;
}

type SortField = "rank" | "name" | "rating" | "games" | "won" | "win_rate" | "point_diff";
type SortOrder = "asc" | "desc";

export function SessionLeaderboard({
  initialRankings = [],
  matches = [],
  sessionTitle = "Session",
  isSessionActive = false,
  isAdmin = false,
  rule = { targetPoints: 11, winByTwo: true },
  sessionId,
  courtNames,
  matchCourtNames,
  activityFeed,
  activityCount,
}: SessionLeaderboardProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (!sessionId || isExporting) return;
    setIsExporting(true);
    try {
      const res = await getSessionExport(sessionId);
      if (res.error || !res.data) {
        alert(res.error || "The export couldn't be made. Please try again.");
        return;
      }
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      for (const sheet of res.data.sheets) {
        const worksheet = sheet.rows.length
          ? XLSX.utils.json_to_sheet(sheet.rows)
          : XLSX.utils.aoa_to_sheet([["Nothing yet"]]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      }
      XLSX.writeFile(workbook, res.data.fileName);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  }
  const [editing, setEditing] = useState<EditableMatch | null>(null);
  const [activeTab, setActiveTab] = useState<"standings" | "matches" | "activity">("standings");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showProvisional, setShowProvisional] = useState(false);

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

  const isQualified = (p: SessionRankedPlayer) => p.qualified ?? p.games_played >= MIN_QUALIFIED_GAMES;
  const hasQualified = initialRankings.some(isQualified);
  const mainSorted = hasQualified ? sorted.filter(isQualified) : sorted;
  const provisionalSorted = hasQualified ? sorted.filter((p) => !isQualified(p)) : [];

  const top3 = (hasQualified
    ? initialRankings.filter(isQualified)
    : initialRankings.filter((p) => p.games_played > 0)
  ).slice(0, 3);
  const completedMatches = matches.filter(
    (m) =>
      m.status === "completed" ||
      Boolean(m.winning_team) ||
      (m.team_a_score !== null &&
        m.team_b_score !== null &&
        (Number(m.team_a_score) > 0 || Number(m.team_b_score) > 0))
  );
  const derivedGamesCount = Math.ceil(
    initialRankings.reduce((sum, p) => sum + (p.games_played || 0), 0) / 4
  );
  const totalGamesPlayed = Math.max(completedMatches.length, derivedGamesCount);
  const visibleMatches = isSessionActive
    ? matches.filter((m) => m.status !== "cancelled" && m.status !== "abandoned")
    : completedMatches;

  const gameNumberById = new Map<string, number>();
  [...matches]
    .filter((m) => m?.id && m.status !== "cancelled" && m.status !== "abandoned")
    .sort((a, b) => {
      const ta = a.started_at || a.created_at || "";
      const tb = b.started_at || b.created_at || "";
      return ta < tb ? -1 : ta > tb ? 1 : String(a.id).localeCompare(String(b.id));
    })
    .forEach((m, idx) => gameNumberById.set(m.id, idx + 1));

  return (
    <div className="space-y-6">
      {/* Tab Switcher & Stats Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 lg:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("standings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer shrink-0 ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer shrink-0 ${
              activeTab === "matches"
                ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <History className="h-4 w-4" />
            Match Logs ({totalGamesPlayed})
          </button>
          {activityFeed && (
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer shrink-0 ${
                activeTab === "activity"
                  ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Activity className="h-4 w-4" />
              Activity{typeof activityCount === "number" && activityCount > 0 ? ` (${activityCount})` : ""}
              {isSessionActive && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && sessionId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              title="Download the leaderboard, attendance and every game as an Excel file"
              className="font-bold text-xs font-mono shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>{isExporting ? "Exporting…" : "Export to Excel"}</span>
            </Button>
          )}
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
              {top3.map((player, position) => {
                // Medal follows the shared rank: two players tied for 1st both get gold.
                const idx = Math.min(2, (player.rank || position + 1) - 1);
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
                        {medalIcons[idx]} {player.tied ? "TIED " : ""}{medalTitles[idx]}
                      </Badge>
                      <span className="text-xs font-mono font-bold">
                        Rating {formatRating(player.skill_rating)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        name={player.full_name || player.display_name}
                        avatarUrl={player.avatar_url}
                        size="md"
                      />
                      <div className="min-w-0 space-y-0.5">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
            <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span>Total wins · Minimum {MIN_QUALIFIED_GAMES} completed games</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>Showing {mainSorted.length} {hasQualified ? "ranked" : "players"}</span>
            </div>
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
                        <span>Rating</span>
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
                  {mainSorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No checked-in players or match records found for this session.
                      </td>
                    </tr>
                  ) : (
                    mainSorted.map((player) => {
                      const isPodium = player.rank <= 3 && player.games_played > 0;
                      return (
                        <tr
                          key={player.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td
                            className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300"
                            title={player.tied ? `Tied for #${player.rank}` : undefined}
                          >
                            {isPodium ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 text-xs">
                                {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : "🥉"}
                              </span>
                            ) : (
                              `#${player.rank}`
                            )}
                            {player.tied && player.games_played > 0 && (
                              <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Tied</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <PlayerAvatar
                                name={player.full_name || player.display_name}
                                avatarUrl={player.avatar_url}
                                size="sm"
                              />
                              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                {player.full_name || player.display_name}
                              </span>
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

          {/* Provisional players (< 3 completed games) */}
          {hasQualified && provisionalSorted.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                  Provisional · fewer than {MIN_QUALIFIED_GAMES} games ({provisionalSorted.length})
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProvisional((v) => !v)}
                  className="h-7 px-2.5 text-xs font-mono cursor-pointer"
                >
                  {showProvisional ? "Hide" : "Show"}
                </Button>
              </div>
              {showProvisional && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {provisionalSorted.map((player) => {
                    const needed = Math.max(0, MIN_QUALIFIED_GAMES - player.games_played);
                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between px-4 py-2.5 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <PlayerAvatar
                            name={player.full_name || player.display_name}
                            avatarUrl={player.avatar_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {player.full_name || player.display_name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {player.win_rate}% win rate · Games played: {player.games_played} · {needed} more to qualify
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-300">
                          {player.games_won} {player.games_won === 1 ? "win" : "wins"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      ) : activeTab === "matches" ? (
        /* Match History Log for this Session */
        <div className="space-y-4">
          {visibleMatches.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 text-center font-mono text-xs text-slate-500">
              No matches recorded for this session yet. Matches played on facility courts will appear here in real time.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleMatches.map((m) => {
                const isCompleted = m.status === "completed";
                const toTeamPlayer = (p: any) => ({
                  id: (p.player_id ?? p.player?.id ?? "") as string,
                  name: (p.player?.full_name || p.player?.display_name || "Player") as string,
                  avatar_url: (p.player?.avatar_url ?? null) as string | null,
                });
                const teamARoster = (m.players || []).filter((p: any) => p.team === "team_a").map(toTeamPlayer);
                const teamBRoster = (m.players || []).filter((p: any) => p.team === "team_b").map(toTeamPlayer);
                const teamAPlayers = teamARoster.map((p: { name: string }) => p.name);
                const teamBPlayers = teamBRoster.map((p: { name: string }) => p.name);

                const teamAWon = m.winning_team === "team_a" || (m.team_a_score > m.team_b_score);
                const teamBWon = m.winning_team === "team_b" || (m.team_b_score > m.team_a_score);
                const duration = isCompleted ? formatMatchDuration(m.started_at, m.ended_at) : null;
                const gameNum = gameNumberById.get(m.id);
                const resolvedCourt =
                  (m.court_id && courtNames?.[m.court_id]) || m.court?.name || matchCourtNames?.[m.id] || "Court";
                const headerLabel = gameNum ? `Game ${gameNum} @ ${resolvedCourt}` : resolvedCourt;

                const resultOnly = isResultOnlyScore(m.team_a_score, m.team_b_score);
                const rows = [
                  { key: "A", roster: teamARoster, players: teamAPlayers, won: teamAWon, score: m.team_a_score ?? 0 },
                  { key: "B", roster: teamBRoster, players: teamBPlayers, won: teamBWon, score: m.team_b_score ?? 0 },
                ];

                return (
                  <Card
                    key={m.id}
                    className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 pb-1">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                        {headerLabel}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.started_at && (
                          <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                            {formatPHTTime(m.started_at)}
                          </span>
                        )}
                        <Badge
                          variant={isCompleted ? "outline" : "volt"}
                          className="font-mono text-[9px] uppercase tracking-wider font-bold"
                        >
                          {isCompleted ? "FINAL" : "IN PLAY"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {rows.map((row) => (
                        <div
                          key={row.key}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                            row.won
                              ? "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/30 text-slate-900 dark:text-slate-100 font-semibold"
                              : "border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {row.won ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            ) : (
                              <span className="h-4 w-4 shrink-0 flex items-center justify-center text-slate-300 dark:text-slate-700" aria-hidden>
                                ·
                              </span>
                            )}
                            {row.roster.length > 0 && (
                              <div className="flex items-center -space-x-1.5 shrink-0">
                                {row.roster.map((p: { id: string; name: string; avatar_url: string | null }, idx: number) => (
                                  <PlayerAvatar
                                    key={p.id || `${row.key}-${idx}`}
                                    name={p.name}
                                    avatarUrl={p.avatar_url}
                                    size="xs"
                                    className="ring-2 ring-white dark:ring-slate-900"
                                  />
                                ))}
                              </div>
                            )}
                            <span className="text-sm truncate">{row.players.join(" & ")}</span>
                          </div>
                          <div className="shrink-0 font-mono font-bold tabular-nums">
                            {resultOnly ? (
                              row.won ? (
                                <span className="rounded-md bg-emerald-600/10 dark:bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                                  WIN
                                </span>
                              ) : (
                                <span className="px-2 text-xs text-slate-400 dark:text-slate-600">—</span>
                              )
                            ) : (
                              <span className={`text-sm ${row.won ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}>
                                {row.score}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(duration || (isAdmin && isCompleted)) && (
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                          {duration ?? ""}
                        </span>
                        {isAdmin && isCompleted && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditing({
                                id: m.id,
                                team_a_score: Number(m.team_a_score ?? 0),
                                team_b_score: Number(m.team_b_score ?? 0),
                                teamA: teamAPlayers,
                                teamB: teamBPlayers,
                              })
                            }
                            className="h-8 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                          >
                            Fix result
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        activityFeed
      )}

      {editing && <EditResultModal match={editing} rule={rule} onClose={() => setEditing(null)} />}

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
