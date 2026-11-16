"use client";

import { useState, useMemo } from "react";
import { Trophy, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getPlayerMatchHistory } from "@/features/players/api/playerActions";
import type { RankedPlayer } from "../api/rankingActions";
import { PlayerPhotoViewer, type PhotoTarget } from "@/features/players/components/PlayerPhotoViewer";
import { podiumSlots } from "../utils/podium";
import { RankingsPodium } from "./RankingsPodium";
import { RankingsLadder, type SortField, type SortOrder } from "./RankingsLadder";
import { NewPlayersList } from "./NewPlayersList";
import { PlayerStatsModal } from "./PlayerStatsModal";

interface LeaderboardTableProps {
  initialRankings?: RankedPlayer[];
  /** Only the System Admin can remove a player's photo from the photo viewer. */
  canRemovePhotos?: boolean;
}

export function LeaderboardTable({ initialRankings = [], canRemovePhotos = false }: LeaderboardTableProps) {
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
          // New players have no rank: last in either direction.
          if (a.rank === null || b.rank === null) {
            return a.rank === b.rank ? 0 : a.rank === null ? 1 : -1;
          }
          comparison = a.rank - b.rank;
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

  // The podium already shows the first three ranked players, so the list starts after
  // them. By position, not rank number: a fourth player tied for 3rd still shows here.
  const isDefaultView = sortField === "rank" && sortOrder === "asc" && !search.trim();
  const rankedCount = rankings.filter((p) => p.rank !== null).length;
  const listRows = isDefaultView ? sorted.filter((p) => p.rank !== null).slice(3) : sorted;
  const newPlayers = sorted.filter((p) => p.rank === null);

  function openPhoto(p: RankedPlayer) {
    if (!p.avatar_url) return;
    setPhotoTarget({ id: p.id, name: p.full_name || p.display_name || "Player", avatarUrl: p.avatar_url });
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
            slots={podiumSlots(rankings)}
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

            {/* Ranked players all on the podium: nothing to list below it */}
            {isDefaultView && listRows.length === 0 && rankedCount > 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Everyone ranked so far is on the podium.</p>
            ) : (
              <RankingsLadder
                rows={listRows}
                search={search}
                emptyMessage="No one is ranked yet."
                sortField={sortField}
                sortOrder={sortOrder}
                onToggleSort={toggleSort}
                onView={handleViewPlayer}
                onPhoto={openPhoto}
              />
            )}
          </section>

          {isDefaultView && <NewPlayersList players={newPlayers} onView={handleViewPlayer} onPhoto={openPhoto} />}
        </>
      )}

      {/* Player photo: anyone can view it; admins can remove it */}
      <PlayerPhotoViewer
        target={photoTarget}
        canRemove={canRemovePhotos}
        onClose={() => setPhotoTarget(null)}
        onRemoved={(id) => {
          setRankings((prev) => prev.map((p) => (p.id === id ? { ...p, avatar_url: null } : p)));
          setSelectedPlayer((prev) => (prev && prev.id === id ? { ...prev, avatar_url: null } : prev));
        }}
      />

      <PlayerStatsModal
        player={selectedPlayer}
        matches={playerMatches}
        isLoading={isLoadingMatches}
        onClose={() => setSelectedPlayer(null)}
        onViewPhoto={setPhotoTarget}
      />
    </div>
  );
}
