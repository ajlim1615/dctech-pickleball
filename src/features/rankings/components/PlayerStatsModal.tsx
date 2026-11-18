"use client";

import { useMemo, useState } from "react";
import { Trophy, X, Loader2, ArrowLeft, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatRating } from "@/lib/utils";
import {
  formatPlacementLabel,
  groupMatchesBySession,
  normalizePlayerMatches,
} from "@/features/players/utils/sessionHistory";
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
  const formattedMatches = useMemo(() => normalizePlayerMatches(matches), [matches]);
  const sessionGroups = useMemo(() => groupMatchesBySession(formattedMatches), [formattedMatches]);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);
  const selectedSession = useMemo(
    () => (selectedSessionKey ? sessionGroups.find((g) => g.key === selectedSessionKey) ?? null : null),
    [selectedSessionKey, sessionGroups]
  );

  function handleClose() {
    setSelectedSessionKey(null);
    onClose();
  }

  return (
    <Modal
      isOpen={Boolean(player)}
      onClose={handleClose}
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
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2 gap-2">
                {selectedSession ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSessionKey(null)}
                    className="inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All sessions
                  </button>
                ) : (
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-emerald-500" />
                    Recent Match History
                  </h3>
                )}
                <span className="text-xs font-mono text-slate-500 truncate">
                  {selectedSession
                    ? `${selectedSession.sessionTitle} · ${selectedSession.matches.length} ${
                        selectedSession.matches.length === 1 ? "match" : "matches"
                      }`
                    : `${sessionGroups.length} ${sessionGroups.length === 1 ? "session" : "sessions"}`}
                </span>
              </div>

              {isLoadingMatches ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400 space-y-2">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-emerald-500" />
                  <p>Loading match history...</p>
                </div>
              ) : sessionGroups.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400 space-y-1.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Trophy className="h-5 w-5 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="text-slate-700 dark:text-slate-300 font-semibold">No Logged Matches</p>
                  <p className="text-slate-500 text-[11px]">This player has not finished any recorded open-play matches yet.</p>
                </div>
              ) : selectedSession ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800/60 max-h-80 overflow-y-auto pr-1">
                  {selectedSession.matches.map((m, idx) => (
                    <div key={m.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold mt-0.5 ${
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
                            {m.duration && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                                • {m.duration}
                              </span>
                            )}
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

                      <div className="font-mono text-sm font-black text-slate-900 dark:text-slate-100 shrink-0 pl-12 sm:pl-0 sm:text-right tabular-nums">
                        {m.score}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800/60 max-h-80 overflow-y-auto pr-1">
                  {sessionGroups.map((group) => {
                    const placementLabel = formatPlacementLabel(group.placement, group.sessionStatus);
                    return (
                      <div
                        key={group.key}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {placementLabel && (
                              <Badge
                                variant={group.placement?.rank === 1 ? "volt" : "secondary"}
                                className="text-[10px] font-mono font-bold py-0.5 px-1.5 shrink-0"
                              >
                                {placementLabel}
                              </Badge>
                            )}
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {group.sessionTitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            <span>{group.date}</span>
                            <span>·</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {group.wins}W - {group.losses}L
                              {group.ties > 0 ? ` - ${group.ties}T` : ""}
                            </span>
                            <span>·</span>
                            <span>
                              {group.matches.length} {group.matches.length === 1 ? "Match" : "Matches"}
                            </span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSessionKey(group.key)}
                          className="min-h-10 sm:min-h-8 shrink-0 text-xs font-semibold cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View matches
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        )}
    </Modal>
  );
}
