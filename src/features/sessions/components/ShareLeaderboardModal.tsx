"use client";

import { useRef, useState } from "react";
import {
  Share2,
  Download,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatPHTDate } from "@/lib/timezone";
import { MIN_QUALIFIED_GAMES, type SessionRankedPlayer } from "../utils/sessionLeaderboard";

interface ShareLeaderboardModalProps {
  isOpen?: boolean;
  onClose: () => void;
  rankings: SessionRankedPlayer[];
  sessionTitle: string;
  totalGames: number;
}

function getPlayerInitials(name: string) {
  if (!name) return "PB";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function TrophySvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="storyCupGrad" x1="16" y1="8" x2="48" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="45%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="storyBaseGrad" x1="20" y1="46" x2="44" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>
      </defs>
      <path d="M18 16H11C9.34315 16 8 17.3431 8 19V22C8 27.5228 12.4772 32 18 32H19.5" stroke="#FFFBEB" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M46 16H53C54.6569 16 56 17.3431 56 19V22C56 27.5228 51.5228 32 46 32H44.5" stroke="#FFFBEB" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M17 11C17 9.89543 17.8954 9 19 9H45C46.1046 9 47 9.89543 47 11V24C47 32.2843 40.2843 39 32 39C23.7157 39 17 32.2843 17 24V11Z" fill="url(#storyCupGrad)" stroke="#92400E" strokeWidth="2" />
      <rect x="28.5" y="38.5" width="7" height="8" rx="1.5" fill="#FDE047" stroke="#92400E" strokeWidth="1.8" />
      <path d="M21 48C21 46.8954 21.8954 46 23 46H41C42.1046 46 43 46.8954 43 48V53C43 54.1046 42.1046 55 41 55H23C21.8954 55 21 54.1046 21 53V48Z" fill="url(#storyBaseGrad)" />
      <rect x="25" y="49" width="14" height="3" rx="1.5" fill="#FBBF24" opacity="0.75" />
    </svg>
  );
}

interface StoryCanvasProps {
  totalPlayers: number;
  effectiveTotalGames: number;
  topPlayers: SessionRankedPlayer[];
  remainingCount: number;
  sessionTitle: string;
  formattedDate: string;
}

/**
 * Full 1080x1920 (9:16) Story layout with 258px top/bottom safe margins
 * for Facebook My Day and Instagram Stories.
 */
function StoryCanvas({
  totalPlayers,
  effectiveTotalGames,
  topPlayers,
  remainingCount,
  sessionTitle,
  formattedDate,
}: StoryCanvasProps) {
  const isEmpty = topPlayers.length === 0;

  return (
    <div
      style={{
        position: "relative",
        width: "1080px",
        height: "1920px",
        overflow: "hidden",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background:
          "radial-gradient(circle at 50% 30%, rgba(34, 197, 94, 0.34) 0%, rgba(16, 128, 72, 0.14) 38%, transparent 68%), radial-gradient(circle at 82% 16%, rgba(250, 204, 21, 0.14) 0%, transparent 40%), radial-gradient(circle at 18% 82%, rgba(74, 222, 128, 0.12) 0%, transparent 45%), linear-gradient(165deg, #0b6e3f 0%, #075330 42%, #04361f 78%, #022414 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: isEmpty ? "265px 84px" : "258px 80px",
        boxSizing: "border-box",
      }}
    >
      {/* Subtle Architectural Pickleball Court Lines */}
      <svg
        viewBox="0 0 1080 1920"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
      >
        <rect x="44" y="44" width="992" height="1832" rx="48" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <line x1="44" y1="680" x2="1036" y2="680" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <line x1="44" y1="1240" x2="1036" y2="1240" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <line x1="540" y1="44" x2="540" y2="680" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
        <line x1="540" y1="1240" x2="540" y2="1876" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
        {isEmpty && (
          <circle cx="540" cy="960" r="340" stroke="rgba(250,204,21,0.06)" strokeWidth="2" strokeDasharray="10 14" />
        )}
      </svg>

      {/* Soft Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 48%, rgba(1, 20, 11, 0.55) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Safe Area Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {isEmpty ? (
          <>
            {/* Empty State Header */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "14px" }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: "112px",
                  lineHeight: 0.94,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#ffffff",
                  textShadow: "0 8px 28px rgba(0, 0, 0, 0.35)",
                }}
              >
                PICKLEBALL
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "12px 34px",
                  borderRadius: "999px",
                  background: "linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(74, 222, 128, 0.14))",
                  border: "1.5px solid rgba(250, 204, 21, 0.42)",
                  fontSize: "32px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "#fef08a",
                }}
              >
                Session Results
              </div>
            </div>

            {/* Empty State Centerpiece */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "48px" }}>
              <div style={{ position: "relative", width: "240px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: "-24px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(250, 204, 21, 0.38) 0%, rgba(250, 204, 21, 0.08) 52%, transparent 72%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "56px",
                    background: "linear-gradient(145deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.03))",
                    border: "2px solid rgba(250, 204, 21, 0.42)",
                    boxShadow: "0 24px 50px rgba(0, 0, 0, 0.35), inset 0 2px 12px rgba(255, 255, 255, 0.18)",
                    transform: "rotate(45deg)",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    width: "176px",
                    height: "176px",
                    borderRadius: "42px",
                    background: "linear-gradient(145deg, #fde047 0%, #f59e0b 55%, #b45309 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 18px 36px rgba(0, 0, 0, 0.38), inset 0 3px 6px rgba(255, 255, 255, 0.65)",
                  }}
                >
                  <TrophySvg size={98} />
                </div>
              </div>

              <div
                style={{
                  width: "100%",
                  borderRadius: "36px",
                  background: "linear-gradient(180deg, rgba(3, 39, 22, 0.82) 0%, rgba(2, 28, 16, 0.92) 100%)",
                  border: "1.5px solid rgba(167, 243, 208, 0.22)",
                  boxShadow: "0 28px 60px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
                  padding: "46px 32px",
                  display: "grid",
                  gridTemplateColumns: "1fr 2px 1fr",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontWeight: 900, fontSize: "96px", lineHeight: 0.95, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                    {totalPlayers}
                  </span>
                  <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "0.22em", color: "#6ee7b7" }}>PLAYERS</span>
                </div>
                <div style={{ width: "2px", height: "110px", background: "linear-gradient(180deg, transparent 0%, rgba(167, 243, 208, 0.35) 50%, transparent 100%)" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontWeight: 900, fontSize: "96px", lineHeight: 0.95, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                    {effectiveTotalGames}
                  </span>
                  <span style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "0.22em", color: "#6ee7b7" }}>GAMES</span>
                </div>
              </div>

              <div
                style={{
                  width: "100%",
                  padding: "28px 36px",
                  borderRadius: "24px",
                  background: "rgba(255, 255, 255, 0.07)",
                  border: "1.5px dashed rgba(167, 243, 208, 0.32)",
                  textAlign: "center",
                  fontSize: "32px",
                  fontWeight: 500,
                  color: "#ecfdf5",
                }}
              >
                No match results recorded yet.
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Populated Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "22px" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "22px",
                  background: "linear-gradient(145deg, #fde047 0%, #f59e0b 55%, #b45309 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 12px 26px rgba(0, 0, 0, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.65)",
                  flexShrink: 0,
                }}
              >
                <TrophySvg size={46} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "86px",
                    lineHeight: 0.92,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#ffffff",
                    textShadow: "0 6px 22px rgba(0, 0, 0, 0.35)",
                  }}
                >
                  PICKLEBALL
                </div>
                <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "0.05em", color: "#fef08a", marginTop: "4px" }}>
                  Session Results
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div
              style={{
                width: "100%",
                borderRadius: "30px",
                background: "linear-gradient(180deg, rgba(3, 39, 22, 0.84) 0%, rgba(2, 28, 16, 0.92) 100%)",
                border: "1.5px solid rgba(167, 243, 208, 0.22)",
                boxShadow: "0 20px 44px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
                padding: "26px 28px",
                display: "grid",
                gridTemplateColumns: "1fr 2px 1fr",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <span style={{ fontWeight: 900, fontSize: "76px", lineHeight: 0.94, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                  {totalPlayers}
                </span>
                <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "0.22em", color: "#6ee7b7" }}>PLAYERS</span>
              </div>
              <div style={{ width: "2px", height: "80px", background: "linear-gradient(180deg, transparent 0%, rgba(167, 243, 208, 0.35) 50%, transparent 100%)" }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <span style={{ fontWeight: 900, fontSize: "76px", lineHeight: 0.94, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                  {effectiveTotalGames}
                </span>
                <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "0.22em", color: "#6ee7b7" }}>GAMES</span>
              </div>
            </div>

            {/* Top 5 Standings List */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "14px" }}>
              {topPlayers.map((player, position) => {
                // Colours and number follow the shared rank: two players tied for 1st are both gold.
                const rankNo = player.rank || position + 1;
                const idx = rankNo - 1;
                const playerName = player.full_name || player.display_name || "Player";
                const initials = getPlayerInitials(playerName);
                const gamesPlayed = player.games_played || 0;
                const tierBg =
                  idx === 0
                    ? "linear-gradient(90deg, rgba(250, 204, 21, 0.18) 0%, rgba(2, 34, 19, 0.85) 55%)"
                    : idx === 1
                    ? "linear-gradient(90deg, rgba(226, 232, 240, 0.14) 0%, rgba(2, 34, 19, 0.82) 55%)"
                    : idx === 2
                    ? "linear-gradient(90deg, rgba(251, 146, 60, 0.15) 0%, rgba(2, 34, 19, 0.82) 55%)"
                    : "rgba(2, 30, 17, 0.72)";
                const tierBorder =
                  idx === 0
                    ? "rgba(250, 204, 21, 0.45)"
                    : idx === 1
                    ? "rgba(226, 232, 240, 0.32)"
                    : idx === 2
                    ? "rgba(251, 146, 60, 0.32)"
                    : "rgba(255, 255, 255, 0.12)";
                const rankBg =
                  idx === 0
                    ? "linear-gradient(135deg, #fde047, #eab308)"
                    : idx === 1
                    ? "linear-gradient(135deg, #f1f5f9, #cbd5e1)"
                    : idx === 2
                    ? "linear-gradient(135deg, #fdba74, #ea580c)"
                    : "rgba(255, 255, 255, 0.1)";
                const rankColor = idx === 0 ? "#422006" : idx === 1 ? "#0f172a" : idx === 2 ? "#431407" : "#d1fae5";

                return (
                  <div
                    key={player.id || position}
                    style={{
                      width: "100%",
                      borderRadius: "24px",
                      background: tierBg,
                      border: `1.5px solid ${tierBorder}`,
                      padding: "18px 24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "18px", minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: "46px",
                          height: "46px",
                          borderRadius: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: "24px",
                          background: rankBg,
                          color: rankColor,
                          flexShrink: 0,
                        }}
                      >
                        {rankNo}
                      </div>

                      <div
                        style={{
                          width: "62px",
                          height: "62px",
                          borderRadius: "50%",
                          overflow: "hidden",
                          background: "#064e2e",
                          border: "2px solid rgba(167, 243, 208, 0.35)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "22px",
                          color: "#a7f3d0",
                          flexShrink: 0,
                        }}
                      >
                        {player.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.avatar_url}
                            alt={playerName}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            crossOrigin="anonymous"
                          />
                        ) : (
                          initials
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: 700,
                            color: "#ffffff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {playerName}
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: 600, color: "#6ee7b7" }}>
                          {gamesPlayed} {gamesPlayed === 1 ? "Game" : "Games"} &bull; {player.win_rate}% Win
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: "16px" }}>
                      <div style={{ fontWeight: 900, fontSize: "42px", lineHeight: 0.95, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                        {player.games_won}
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "0.16em", color: "#a7f3d0" }}>WINS</div>
                    </div>
                  </div>
                );
              })}

              {remainingCount > 0 && (
                <div style={{ fontSize: "23px", fontWeight: 600, color: "#a7f3d0", textAlign: "center", marginTop: "4px" }}>
                  + {remainingCount} more player{remainingCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
          <div style={{ width: "100%", height: "1.5px", background: "linear-gradient(90deg, transparent 0%, rgba(167, 243, 208, 0.38) 50%, transparent 100%)" }} />
          <div
            style={{
              fontSize: "27px",
              fontWeight: 600,
              letterSpacing: "0.03em",
              color: "#d1fae5",
              textAlign: "center",
              maxWidth: "100%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            @{sessionTitle} &bull; {formattedDate}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShareLeaderboardModal({
  isOpen = true,
  onClose,
  rankings = [],
  sessionTitle = "Open Play Session",
  totalGames = 0,
}: ShareLeaderboardModalProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isOpen === false) return null;

  const totalPlayers = rankings.length;
  const activePlayers = rankings.filter((p) => p.games_played > 0);
  const qualifiedPlayers = activePlayers.filter(
    (p) => p.qualified ?? p.games_played >= MIN_QUALIFIED_GAMES
  );
  const pool =
    qualifiedPlayers.length > 0
      ? qualifiedPlayers
      : activePlayers.length > 0
      ? activePlayers
      : rankings;
  const topPlayers = pool.slice(0, 5);
  const remainingCount = Math.max(0, totalPlayers - topPlayers.length);

  const derivedGames = Math.ceil(
    rankings.reduce((sum, p) => sum + (p.games_played || 0), 0) / 4
  );
  const effectiveTotalGames = Math.max(totalGames, derivedGames);

  const formattedDate = formatPHTDate(new Date(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  async function renderStoryPngBlob(): Promise<{ blob: Blob; filename: string } | null> {
    if (!exportRef.current) return null;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(exportRef.current, {
      cacheBust: true,
      pixelRatio: 1,
      width: 1080,
      height: 1920,
    });
    const blob = await (await fetch(dataUrl)).blob();
    const safeTitle = sessionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "leaderboard";
    return { blob, filename: `session-results-story-${safeTitle}.png` };
  }

  async function handleDownloadImage() {
    if (!exportRef.current) return;
    try {
      setIsDownloading(true);
      const rendered = await renderStoryPngBlob();
      if (!rendered) return;
      const { blob, filename } = rendered;

      // iOS Safari / PWAs don't save <a download> to Photos; the native share sheet has "Save Image".
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isIOS && navigator.share) {
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: `${sessionTitle} Leaderboard`, files: [file] });
          return;
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      if ("download" in HTMLAnchorElement.prototype) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Error generating image:", err);
      alert("Failed to export image. You can use the Share or Copy option.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleShare() {
    let shareText = `🏆 ${sessionTitle} Results\n📅 ${formattedDate}\n👥 ${totalPlayers} Players • 🏓 ${effectiveTotalGames} Games\n\n`;
    topPlayers.forEach((p, idx) => {
      const rankNo = p.rank || idx + 1;
      const medals = ["🥇", "🥈", "🥉"];
      shareText += `${medals[rankNo - 1] || `${rankNo}.`} ${p.full_name || p.display_name}: ${p.games_won}W/${p.games_played}G (${p.win_rate}%)\n`;
    });
    if (remainingCount > 0) {
      shareText += `\n+ ${remainingCount} more players\n`;
    }

    if (navigator.share && exportRef.current) {
      try {
        setIsDownloading(true);
        const rendered = await renderStoryPngBlob();
        const file = rendered
          ? new File([rendered.blob], "pickleball-story-leaderboard.png", { type: "image/png" })
          : null;

        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
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

  const storyProps: StoryCanvasProps = {
    totalPlayers,
    effectiveTotalGames,
    topPlayers,
    remainingCount,
    sessionTitle,
    formattedDate,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl relative my-auto cursor-default">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Share Leaderboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Optimized 9:16 Story format (1080 × 1920)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scaled 9:16 Story Preview */}
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-2xl shadow-2xl border border-emerald-400/30 select-none"
            style={{ width: "243px", height: "432px" }}
          >
            <div
              style={{
                width: "1080px",
                height: "1920px",
                transform: "scale(0.225)",
                transformOrigin: "top left",
              }}
            >
              <StoryCanvas {...storyProps} />
            </div>
          </div>
        </div>

        {/* Offscreen Full-Res 1080x1920 Export Target */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-99999px",
            top: 0,
            width: "1080px",
            height: "1920px",
            pointerEvents: "none",
            opacity: 1,
          }}
        >
          <div ref={exportRef}>
            <StoryCanvas {...storyProps} />
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
