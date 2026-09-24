"use client";

import { useRef, useState } from "react";
import {
  Trophy,
  Share2,
  Download,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatRating } from "@/lib/utils";
import type { SessionRankedPlayer } from "../utils/sessionLeaderboard";

interface ShareLeaderboardModalProps {
  isOpen?: boolean;
  onClose: () => void;
  rankings: SessionRankedPlayer[];
  sessionTitle: string;
  totalGames: number;
}

export function ShareLeaderboardModal({
  isOpen = true,
  onClose,
  rankings = [],
  sessionTitle = "Open Play Session",
  totalGames = 0,
}: ShareLeaderboardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isOpen === false) return null;

  const totalPlayers = rankings.length;
  const activePlayers = rankings.filter((p) => p.games_played > 0);
  const topPlayers = (activePlayers.length > 0 ? activePlayers : rankings).slice(0, 5);
  const remainingCount = Math.max(
    0,
    (activePlayers.length > 0 ? activePlayers.length : rankings.length) - 5
  );

  const derivedGames = Math.ceil(
    rankings.reduce((sum, p) => sum + (p.games_played || 0), 0) / 4
  );
  const effectiveTotalGames = Math.max(totalGames, derivedGames);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  async function handleDownloadImage() {
    if (!cardRef.current) return;
    try {
      setIsDownloading(true);
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3, // Crisp high-res export
      });
      const link = document.createElement("a");
      const safeTitle = sessionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.download = `dctech-session-results-${safeTitle}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error generating image:", err);
      alert("Failed to export image. You can use the Share or Copy option.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleShare() {
    let shareText = `🏆 ${sessionTitle} Results\n📅 ${formattedDate}\n👥 ${totalPlayers} Players • 🏓 ${effectiveTotalGames} Games\n\n`;
    topPlayers.forEach((p, idx) => {
      const medals = ["🥇", "🥈", "🥉", "4.", "5."];
      shareText += `${medals[idx] || `${idx + 1}.`} ${p.full_name || p.display_name}: ${p.games_won}W (${p.win_rate}%) • DUPR ${formatRating(p.skill_rating)}\n`;
    });
    if (remainingCount > 0) {
      shareText += `\n+ ${remainingCount} more players\n`;
    }

    if (navigator.share && cardRef.current) {
      try {
        setIsDownloading(true);
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "dctech-leaderboard.png", { type: "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${sessionTitle} Leaderboard`,
            text: shareText,
            files: [file],
          });
          setIsDownloading(false);
          return;
        } else {
          await navigator.share({
            title: `${sessionTitle} Leaderboard`,
            text: shareText,
            url: window.location.href,
          });
          setIsDownloading(false);
          return;
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.warn("Native share failed, copying to clipboard instead.", e);
        }
      } finally {
        setIsDownloading(false);
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      alert("Sharing not supported on this browser.");
    }
  }

  function getPlayerInitials(name: string) {
    if (!name) return "PB";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-2xl relative my-auto cursor-default">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Share Leaderboard
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* The Branded Social-Ready Card */}
        <div className="flex justify-center">
          <div
            ref={cardRef}
            className="relative w-full max-w-xs rounded-3xl bg-gradient-to-b from-[#0a8247] via-[#09713d] to-[#064e29] text-white p-5 shadow-2xl space-y-4 font-sans select-none border border-emerald-400/30 overflow-hidden"
            style={{ width: "320px" }}
          >
            {/* Top-Right Brand Logo Badge */}
            <div className="absolute top-4 right-4 z-20 pointer-events-none">
              <div className="h-9 w-9 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 p-1 shadow-lg flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-192.png"
                  alt="DCTECH"
                  className="h-full w-full object-contain rounded-xl drop-shadow-xs"
                  crossOrigin="anonymous"
                />
              </div>
            </div>

            {/* Enhanced DCTECH Background Watermarks (Multi-Zone & Repeated Diagonal Pattern) */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0">
              {/* Large Upper Diagonal Stamp */}
              <div className="absolute -top-4 -left-6 text-[46px] font-black tracking-widest text-white/[0.12] -rotate-[28deg] uppercase select-none font-mono whitespace-nowrap">
                DCTECH
              </div>

              {/* Center Main Bold Watermark */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-[64px] font-black tracking-widest text-white/[0.14] -rotate-[28deg] uppercase select-none font-mono">
                  DCTECH
                </div>
              </div>

              {/* Lower Right Repeating Diagonal Stamp */}
              <div className="absolute -bottom-6 -right-6 text-[46px] font-black tracking-widest text-white/[0.12] -rotate-[28deg] uppercase select-none font-mono whitespace-nowrap">
                DCTECH
              </div>

              {/* Ambient radial lighting glow for depth */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.25),transparent_60%)]" />
            </div>

            {/* Content Layer (z-10) */}
            <div className="relative z-10 space-y-4">
              {/* Header / Brand */}
              <div className="text-center space-y-1 pr-6 pl-6">
                <div className="text-sm font-extrabold tracking-wider uppercase text-emerald-100 drop-shadow-xs">
                  Pickleball
                </div>
                <div className="text-[11px] font-medium text-emerald-200/95 tracking-wide">
                  Session Results
                </div>
                <div className="pt-2 flex justify-center">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-200 flex items-center justify-center shadow-lg text-2xl border border-amber-200/60">
                    🏆
                  </div>
                </div>
              </div>

              {/* Players & Games Summary Box */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/30 border border-white/15 p-2.5 text-center backdrop-blur-xs shadow-inner">
                <div className="space-y-0.5">
                  <div className="text-lg font-black text-white leading-none">
                    {totalPlayers}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-emerald-200/90">
                    PLAYERS
                  </div>
                </div>
                <div className="space-y-0.5 border-l border-white/10">
                  <div className="text-lg font-black text-white leading-none">
                    {effectiveTotalGames}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-emerald-200/90">
                    GAMES
                  </div>
                </div>
              </div>

              {/* Top 5 Standings List with Profile Pictures */}
              <div className="space-y-1.5 pt-0.5">
                {topPlayers.length === 0 ? (
                  <div className="py-4 text-center text-xs text-emerald-200">
                    No match results recorded yet.
                  </div>
                ) : (
                  topPlayers.map((player, idx) => {
                    const rankIcons = ["🥇", "🥈", "🥉", "4", "5"];
                    const playerName = player.full_name || player.display_name || "Player";
                    const initials = getPlayerInitials(playerName);

                    return (
                      <div
                        key={player.id || idx}
                        className="rounded-2xl bg-black/25 hover:bg-black/35 border border-white/10 px-3 py-2 flex items-center justify-between gap-2.5 text-xs transition-colors backdrop-blur-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {/* Rank Icon / Number */}
                          <span className="font-extrabold text-xs w-4 text-center shrink-0">
                            {rankIcons[idx]}
                          </span>

                          {/* Profile Picture / Avatar */}
                          <div className="h-7 w-7 rounded-full overflow-hidden border border-white/30 bg-emerald-950/80 flex items-center justify-center shrink-0 shadow-xs">
                            {player.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.avatar_url}
                                alt={playerName}
                                className="h-full w-full object-cover"
                                crossOrigin="anonymous"
                              />
                            ) : (
                              <span className="text-[10px] font-bold font-mono text-emerald-200">
                                {initials}
                              </span>
                            )}
                          </div>

                          {/* Name and Rating */}
                          <div className="truncate">
                            <div className="font-bold text-white text-[11px] truncate leading-tight">
                              {playerName}
                            </div>
                            <div className="text-[9px] text-emerald-200/90 font-mono flex items-center gap-1">
                              <span>DUPR {formatRating(player.skill_rating)}</span>
                              {player.win_rate > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{player.win_rate}% Win</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Wins Score */}
                        <div className="text-right shrink-0">
                          <div className="font-black text-white text-xs leading-tight">
                            {player.games_won}
                          </div>
                          <div className="text-[8px] uppercase tracking-wider text-emerald-200/80 font-semibold">
                            wins
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {remainingCount > 0 && (
                  <div className="text-[10px] text-center text-emerald-200/90 font-medium pt-1">
                    +{remainingCount} more player{remainingCount > 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* Card Footer (Cleaned: No URL, Just Session Title & Date) */}
              <div className="pt-2.5 border-t border-white/15 text-center">
                <div className="text-[10px] font-medium text-emerald-100/95 truncate">
                  @{sessionTitle} • {formattedDate}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              onClick={handleShare}
              disabled={isDownloading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-2xl text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-200" />
                  Copied Text!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Share
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadImage}
              disabled={isDownloading}
              className="flex-1 py-5 rounded-2xl text-sm font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {isDownloading ? "Saving..." : "Save Image"}
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full py-4 rounded-2xl text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
