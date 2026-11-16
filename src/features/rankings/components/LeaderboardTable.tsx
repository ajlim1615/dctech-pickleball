"use client";

import { useState, useMemo } from "react";
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
import { Modal } from "@/components/ui/modal";
import { formatRating } from "@/lib/utils";
import { formatPHTDate } from "@/lib/timezone";
import { getPlayerMatchHistory } from "@/features/players/api/playerActions";
import type { RankedPlayer } from "../api/rankingActions";
import { formatMatchScore } from "@/features/matches/utils/scoring";
import { PlayerPhotoViewer, type PhotoTarget } from "@/features/players/components/PlayerPhotoViewer";
import { RankingsPodium } from "./RankingsPodium";

interface LeaderboardTableProps {
  initialRankings?: RankedPlayer[];
  /** Admins can remove a player's photo from the photo viewer. */
  isAdmin?: boolean;
}

type SortField = "rank" | "name" | "rating" | "games" | "won" | "win_rate";
type SortOrder = "asc" | "desc";

export function LeaderboardTable({ initialRankings = [], isAdmin = false }: LeaderboardTableProps) {
  const [search, setSearch] = useState("");
  const [rankings, setRankings] = useState<RankedPlayer[]>(initialRankings);
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<RankedPlayer | null>(null);
  const [playerMatches, setPlayerMatches] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "name" || field === "rank" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rankings.filter((r) =>
          (r.full_name || r.display_name || "").toLowerCase().includes(query)
        )
      : rankings;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "rank":
          comparison = (a.rank ?? 1e9) - (b.rank ?? 1e9);
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
  }, [rankings, search, sortField, sortOrder]);

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
  const formattedMatches = useMemo(() => {
    return playerMatches.map((item: any) => {
      if (item.result && item.score) return item;

      const match = item.match || item;
      const playerTeam = item.team;
      let isWon = false;
      if (match.winning_team) {
        isWon = match.winning_team === playerTeam;
      } else if (match.team_a_score !== undefined && match.team_b_score !== undefined) {
        const winningSide =
          match.team_a_score > match.team_b_score
            ? "team_a"
            : match.team_b_score > match.team_a_score
            ? "team_b"
            : "tie";
        isWon = winningSide === playerTeam;
      }
      const isTie = match.winning_team === "tie";
      const isInProgress = match.status === "in_progress";

      const result = isInProgress ? "LIVE" : isTie ? "TIE" : isWon ? "WIN" : "LOSS";
      const courtName =
        (match.court as any)?.name || (typeof match.court === "string" ? match.court : "Court");
      const formatLabel = match.format === "doubles" ? "Doubles (2v2)" : "Singles (1v1)";
      const sessionTitle = item.sessionTitle || "Open Play Session";
      const partner = item.partner;
      const opponents = item.opponents;
      const dateSource = match.ended_at || match.started_at || item.created_at;
      const dateLabel = dateSource ? formatPHTDate(dateSource) : "Recent";
      const scoreLabel = formatMatchScore(match.team_a_score, match.team_b_score);

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
  }, [playerMatches]);

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

  // The podium already shows the top three, so the list starts at #4 in the default view.
  const isDefaultView = sortField === "rank" && sortOrder === "asc" && !search.trim();
  const listRows = isDefaultView ? sorted.filter((p) => p.rank === null || p.rank > 3) : sorted;
  const SORT_LABELS: Record<SortField, string> = {
    rank: "Rank",
    name: "Name",
    rating: "Rating",
    games: "Games",
    won: "Wins",
    win_rate: "Win rate",
  };

  function openPhoto(p: RankedPlayer) {
    if (!p.avatar_url) return;
    setPhotoTarget({ id: p.id, name: p.full_name || p.display_name || "Player", avatarUrl: p.avatar_url });
  }

  function sortHeader(field: SortField, align: "left" | "center" | "right" = "left") {
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
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
    <div className="mx-auto max-w-5xl px-3.5 sm:px-6 py-6 sm:py-8 space-y-8">
      {rankings.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-12 text-center shadow-sm">
          <Trophy className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">No rankings yet</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Rankings show up once players are added. Ratings move after every ranked game.
          </p>
        </Card>
      ) : (
        <>
          <RankingsPodium
            top={rankings.filter((p) => p.rank !== null).slice(0, 3)}
            totalPlayers={rankings.length}
            onView={handleViewPlayer}
            onPhoto={openPhoto}
          />

          {/* Everyone else */}
          <section aria-labelledby="ladder-heading" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 id="ladder-heading" className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {isDefaultView ? "The rest of the ladder" : `${listRows.length} ${listRows.length === 1 ? "player" : "players"}`}
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    type="search"
                    placeholder="Search players"
                    aria-label="Search players"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                {/* Phones have no column headers, so sorting lives here */}
                <select
                  aria-label="Sort players"
                  value={`${sortField}:${sortOrder}`}
                  onChange={(e) => {
                    const [f, o] = e.target.value.split(":") as [SortField, SortOrder];
                    setSortField(f);
                    setSortOrder(o);
                  }}
                  className="sm:hidden h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="rank:asc">Rank</option>
                  <option value="rating:desc">Rating</option>
                  <option value="won:desc">Wins</option>
                  <option value="win_rate:desc">Win rate</option>
                  <option value="games:desc">Games</option>
                  <option value="name:asc">Name</option>
                </select>
              </div>
            </div>

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

              {listRows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No players match &quot;{search}&quot;. Try a first or last name.
                </p>
              ) : (
                <ol className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {listRows.map((player) => {
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
                        className="grid grid-cols-[44px_minmax(0,1fr)_auto] sm:grid-cols-[64px_minmax(0,1fr)_88px_72px_72px_80px_88px] items-center gap-2 px-3 sm:px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <span className={`font-mono text-sm font-black tabular-nums ${medal}`}>{player.rank === null ? "—" : `#${player.rank}`}</span>

                        <div className="flex items-center gap-3 min-w-0">
                          {player.avatar_url ? (
                            <button
                              type="button"
                              onClick={() => openPhoto(player)}
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
                            onClick={() => handleViewPlayer(player)}
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
                            onClick={() => handleViewPlayer(player)}
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
          </section>
        </>
      )}

      {/* Player photo: anyone can view it; admins can remove it */}
      <PlayerPhotoViewer
        target={photoTarget}
        canRemove={isAdmin}
        onClose={() => setPhotoTarget(null)}
        onRemoved={(id) => {
          setRankings((prev) => prev.map((p) => (p.id === id ? { ...p, avatar_url: null } : p)));
          setSelectedPlayer((prev) => (prev && prev.id === id ? { ...prev, avatar_url: null } : prev));
        }}
      />

      {/* View Player Stats & History Modal */}
      <Modal
        isOpen={Boolean(selectedPlayer)}
        onClose={() => setSelectedPlayer(null)}
      >
        {selectedPlayer && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto cursor-default">
            {/* Modal Header: Profile Picture, Name, Email, Rank */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-4 sm:gap-5">
                {selectedPlayer.avatar_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoTarget({
                        id: selectedPlayer.id,
                        name: selectedPlayer.full_name || selectedPlayer.display_name || "Player",
                        avatarUrl: selectedPlayer.avatar_url!,
                      })
                    }
                    title="View photo"
                    aria-label={`View ${selectedPlayer.full_name || "player"}'s photo`}
                    className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-500/50 shadow-md cursor-zoom-in hover:ring-2 hover:ring-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedPlayer.avatar_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-slate-100 dark:bg-slate-950 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 shadow-md">
                    {selectedPlayer.full_name?.slice(0, 2).toUpperCase() || "DC"}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                      {selectedPlayer.full_name || selectedPlayer.display_name}
                    </h2>
                    <Badge variant="volt" className="text-xs font-mono font-bold">
                      {selectedPlayer.rank === null ? "—" : `#${selectedPlayer.rank}`} Rank
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
        )}
      </Modal>
    </div>
  );
}
