"use client";

import { useMemo } from "react";
import { Trophy, X, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatRating } from "@/lib/utils";
import { formatPHTDate } from "@/lib/timezone";
import { formatMatchScore } from "@/features/matches/utils/scoring";
import type { PhotoTarget } from "@/features/players/components/PlayerPhotoViewer";
import type { RankedPlayer } from "../api/rankingActions";

interface PlayerStatsModalProps {
  player: RankedPlayer | null;
  /** Raw match history rows for the player. */
  matches: any[];
  isLoading: boolean;
  onClose: () => void;
  onViewPhoto: (target: PhotoTarget) => void;
}

export function PlayerStatsModal({ player, matches, isLoading: isLoadingMatches, onClose, onViewPhoto }: PlayerStatsModalProps) {
  // Format matches for player detail view
  const formattedMatches = useMemo(() => {
    return matches.map((item: any) => {
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
  }, [matches]);

  return (
    <Modal
      isOpen={Boolean(player)}
      onClose={onClose}
    >
        {player && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto cursor-default">
            {/* Modal Header: Profile Picture, Name, Email, Rank */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-4 sm:gap-5">
                {player.avatar_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      onViewPhoto({
                        id: player.id,
                        name: player.full_name || player.display_name || "Player",
                        avatarUrl: player.avatar_url!,
                      })
                    }
                    title="View photo"
                    aria-label={`View ${player.full_name || "player"}'s photo`}
                    className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-500/50 shadow-md cursor-zoom-in hover:ring-2 hover:ring-emerald-500/60 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-slate-100 dark:bg-slate-950 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 shadow-md">
                    {player.full_name?.slice(0, 2).toUpperCase() || "DC"}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                      {player.full_name || player.display_name}
                    </h2>
                    <Badge variant="volt" className="text-xs font-mono font-bold">
                      {player.rank === null ? "New" : `#${player.rank} Rank${player.tied ? " (tied)" : ""}`}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {player.email}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                      {player.role}
                    </Badge>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Verified DCTECH Player
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClose()}
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
                  {player.games_played}
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-center shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase">GAMES WON</div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {player.games_won}
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-center shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase">WIN RATE</div>
                <div className="text-2xl font-extrabold text-emerald-700 dark:text-[#d4e938] mt-0.5">
                  {player.win_rate}%
                </div>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 text-center shadow-2xs">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase">SKILL RATING</div>
                <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5 font-mono">
                  {formatRating(player.skill_rating)}
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
                onClick={() => onClose()}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        )}
    </Modal>
  );
}
