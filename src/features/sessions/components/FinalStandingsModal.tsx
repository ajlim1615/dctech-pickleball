"use client";

import { useState } from "react";
import { Trophy, Award, Medal, Share2, ArrowRight, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRating } from "@/lib/utils";
import type { SessionRankedPlayer } from "../utils/sessionLeaderboard";
import { ShareLeaderboardModal } from "./ShareLeaderboardModal";
import { Modal } from "@/components/ui/modal";

interface FinalStandingsModalProps {
  sessionTitle: string;
  rankings: SessionRankedPlayer[];
  totalGames: number;
  onClose: () => void;
}

export function FinalStandingsModal({
  sessionTitle,
  rankings,
  totalGames,
  onClose,
}: FinalStandingsModalProps) {
  const [showShareCard, setShowShareCard] = useState(false);

  const activePlayers = rankings.filter((p) => p.games_played > 0);
  const displayRankings = activePlayers.length > 0 ? activePlayers : rankings;
  const top3 = displayRankings.slice(0, 3);
  const derivedGames = Math.ceil(
    rankings.reduce((sum, p) => sum + (p.games_played || 0), 0) / 4
  );
  const effectiveTotalGames = Math.max(totalGames, derivedGames);

  return (
    <>
      <Modal isOpen={true} onClose={onClose}>
        <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 relative my-auto cursor-default animate-in zoom-in-95 duration-200">
          {/* Header Banner */}
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-200 text-amber-950 flex items-center justify-center text-2xl shadow-lg border border-amber-300">
                🏆
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="volt" className="text-[10px] font-mono font-bold uppercase py-0.5 px-2">
                    SESSION COMPLETED
                  </Badge>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {displayRankings.length} Players • {effectiveTotalGames} Matches
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 mt-1">
                  Final {sessionTitle} Standings
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Top 3 Champions Podium */}
          {top3.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span>Session Podium</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3.map((player, idx) => {
                  const medalLabels = ["🥇 GOLD", "🥈 SILVER", "🥉 BRONZE"];
                  const medalBg = [
                    "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-400/30",
                    "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50",
                    "border-amber-700/30 bg-amber-900/10 dark:bg-amber-950/10",
                  ];
                  return (
                    <Card
                      key={player.id}
                      className={`p-4 text-center space-y-2.5 rounded-2xl border shadow-sm ${medalBg[idx]}`}
                    >
                      <div className="text-[11px] font-bold font-mono text-amber-600 dark:text-amber-400">
                        {medalLabels[idx]}
                      </div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-base font-bold text-slate-800 dark:text-slate-100 shadow-xs overflow-hidden">
                        {player.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.avatar_url}
                            alt={player.full_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          player.full_name?.slice(0, 2).toUpperCase() || "PB"
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {player.full_name || player.display_name}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          DUPR {formatRating(player.skill_rating)}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-around text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block">WINS</span>
                          <span className="font-extrabold text-slate-900 dark:text-slate-100">
                            {player.games_won}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">WIN %</span>
                          <span className="font-extrabold text-slate-900 dark:text-slate-100">
                            {player.win_rate}%
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standings Table Preview */}
          <div className="space-y-2">
            <div className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rankings Breakdown
            </div>
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 bg-slate-50/40 dark:bg-slate-950/40">
              {displayRankings.slice(0, 10).map((player, idx) => (
                <div
                  key={player.id}
                  className="px-4 py-2.5 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-400 w-5 text-center">
                      #{idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700">
                        {player.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          player.full_name?.slice(0, 2).toUpperCase() || "PB"
                        )}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px] sm:max-w-[200px]">
                        {player.full_name || player.display_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {player.games_won}W - {player.games_lost}L
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {player.win_rate}% Win
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="volt"
              onClick={() => setShowShareCard(true)}
              className="font-bold text-xs font-mono shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
              <span>Share / Save Leaderboard Graphic</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="font-semibold text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Full Session Archive</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Modal>

      {showShareCard && (
        <ShareLeaderboardModal
          sessionTitle={sessionTitle}
          rankings={displayRankings}
          totalGames={effectiveTotalGames}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </>
  );
}
