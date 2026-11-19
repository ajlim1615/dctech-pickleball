"use client";

import { Crown, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatRating } from "@/lib/utils";
import type { RankedPlayer } from "../utils/leaderboard";
import { throneRoom } from "../utils/throneRoom";

/*
 * The throne room meme: the #1 ranked player alone on the throne, the next ranked
 * players kneeling before it. An original drawing in the app's style (not the comic
 * panel it's based on). The scene is always dark, like the Rankings header.
 */

const nameOf = (p: RankedPlayer) => p.full_name || p.display_name || "Player";
const initialsOf = (p: RankedPlayer) => nameOf(p).trim().slice(0, 2).toUpperCase();

/** Where each kneeler goes (percent of the scene), best ranked first: 2 front, 4 middle, 6 back. */
const SPOTS: { x: number; y: number; size: number }[] = [
  { x: 15, y: 86, size: 22 },
  { x: 85, y: 86, size: 22 },
  { x: 22, y: 74, size: 12.5 },
  { x: 40, y: 75, size: 12.5 },
  { x: 60, y: 75, size: 12.5 },
  { x: 78, y: 74, size: 12.5 },
  { x: 22, y: 65.5, size: 7.5 },
  { x: 33, y: 66, size: 7.5 },
  { x: 44, y: 66.5, size: 7.5 },
  { x: 56, y: 66.5, size: 7.5 },
  { x: 67, y: 66, size: 7.5 },
  { x: 78, y: 65.5, size: 7.5 },
];

/** Cloak colours for the kneeling players. */
const CLOAKS = ["#7c5cd6", "#3fae8a", "#8b93a7", "#7a5a43", "#c7ccd8", "#4b5a7d", "#a0567a", "#5d7f3a", "#c08a3e", "#3d7ca8", "#8a6fb3", "#6b7280"];

function Head({ player, className }: { player: RankedPlayer; className: string }) {
  return player.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={player.avatar_url} alt="" className={`${className} object-cover`} />
  ) : (
    <span className={`${className} flex items-center justify-center bg-slate-700 font-mono font-bold text-slate-100`}>
      {initialsOf(player)}
    </span>
  );
}

/** A player kneeling with their head bowed toward the throne, seen from behind. */
function Kneeler({ player, spot, cloak }: { player: RankedPlayer; spot: (typeof SPOTS)[number]; cloak: string }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.size}%` }}
      title={`#${player.rank} ${nameOf(player)}`}
    >
      <div className="relative motion-safe:animate-[throne-bow_3.2s_ease-in-out_infinite] origin-bottom">
        {/* Bowed head, just showing above the back */}
        <Head
          player={player}
          className="absolute left-1/2 top-0 z-0 aspect-square w-[46%] -translate-x-1/2 -translate-y-[38%] rounded-full ring-2 ring-black/40 text-[min(2.6vw,11px)]"
        />
        {/* Hunched back and folded legs */}
        <svg viewBox="0 0 100 70" className="relative z-10 block w-full drop-shadow-[0_6px_6px_rgba(0,0,0,0.45)]" aria-hidden>
          <path d="M8 62 C6 30 24 8 50 8 C76 8 94 30 92 62 Z" fill={cloak} />
          <path d="M8 62 C6 30 24 8 50 8 C62 8 72 12 80 19 C60 16 34 26 24 62 Z" fill="#000" opacity="0.18" />
          <rect x="14" y="58" width="72" height="9" rx="4.5" fill="#1f2937" opacity="0.85" />
        </svg>
        <span className="absolute bottom-[14%] left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-1 font-mono text-[min(2.4vw,10px)] font-bold leading-tight text-white">
          {player.rank}
        </span>
      </div>
    </div>
  );
}

/** A knight guarding the throne: #2 on the left, #3 on the right, their face in the open helmet. */
function Knight({ side, player }: { side: "left" | "right"; player: RankedPlayer | null }) {
  return (
    <div
      className={`absolute top-[33%] w-[19%] ${side === "left" ? "left-[2%]" : "right-[2%]"}`}
      title={player ? `#${player.rank} ${nameOf(player)}, royal guard` : undefined}
    >
      <svg viewBox="0 0 60 150" aria-hidden className={`block w-full ${side === "right" ? "-scale-x-100" : ""}`}>
        <g fill="#8fb3cf" stroke="#0b1324" strokeWidth="2.5" strokeLinejoin="round">
          {/* Helmet with an open face, plume on top */}
          <path d="M30 0 Q36 -2 34 8" fill="#c0567a" />
          <path d="M14 30 L14 10 Q30 -2 46 10 L46 30 Z" />
          <path d="M10 32 L50 32 L54 90 L6 90 Z" />
          <path d="M14 90 L46 90 L48 146 L12 146 Z" />
          <path d="M30 34 L30 140" fill="none" />
          <rect x="26" y="40" width="8" height="104" rx="2" fill="#c9dbe9" />
          <rect x="18" y="44" width="24" height="5" rx="2" />
        </g>
      </svg>
      {player && (
        <>
          {/* Their face in the helmet opening */}
          <Head
            player={player}
            className="absolute left-1/2 top-[7.5%] aspect-square w-[46%] -translate-x-1/2 rounded-full ring-2 ring-[#0b1324] text-[min(2.6vw,11px)]"
          />
          <span className="absolute -bottom-[2%] left-1/2 w-max max-w-[140%] -translate-x-1/2 truncate rounded-md bg-black/60 px-1.5 py-0.5 text-center text-[min(2.6vw,10px)] font-bold leading-tight text-white">
            #{player.rank} {nameOf(player).split(" ")[0]}
          </span>
        </>
      )}
    </div>
  );
}

export function ThroneRoomModal({
  isOpen,
  onClose,
  players,
}: {
  isOpen: boolean;
  onClose: () => void;
  players: RankedPlayer[];
}) {
  const { ruler, guards, kneeling, tieBrokenBy } = throneRoom(players);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="relative w-[min(92vw,440px)] cursor-default">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the throne room"
          className="absolute -top-2 -right-2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          <X className="h-5 w-5" />
        </button>

        <figure className="overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1324] shadow-2xl">
          {/* The scene */}
          <div
            className="relative aspect-[9/13] w-full overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(55% 40% at 50% 30%, rgba(143,179,207,0.28), transparent 70%), linear-gradient(180deg, #1d2c4c 0%, #172440 55%, #0e1730 100%)",
            }}
            role="img"
            aria-label={
              ruler
                ? `${nameOf(ruler)}, ranked number 1, on the throne.${guards.left ? ` Guarded by ${nameOf(guards.left)}${guards.right ? ` and ${nameOf(guards.right)}` : ""}.` : ""
                } ${kneeling.length} players kneel before them.`
                : "An empty throne. No one is ranked yet."
            }
          >
            {/* Wall: arch with string lights, brick lines */}
            <svg viewBox="0 0 90 130" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              <path d="M0 14 Q45 2 90 14" fill="none" stroke="#2c3e63" strokeWidth="1.2" />
              {Array.from({ length: 9 }, (_, i) => {
                const x = 6 + i * 9.75;
                const y = 14 - Math.sin((x / 90) * Math.PI) * 9 + 2;
                return (
                  <g key={i}>
                    <line x1={x} y1={y - 2} x2={x} y2={y + 2.5} stroke="#3b5079" strokeWidth="0.5" />
                    <circle cx={x} cy={y + 3.2} r="1.1" fill="#fff6c9" />
                    <circle cx={x} cy={y + 3.2} r="2.6" fill="#fff6c9" opacity="0.18" />
                  </g>
                );
              })}
              {[30, 36, 42].map((y) => (
                <line key={y} x1="0" y1={y} x2="90" y2={y} stroke="#24365a" strokeWidth="0.35" />
              ))}
              {[8, 22, 68, 82].map((x) => (
                <line key={x} x1={x} y1="16" x2={x} y2="80" stroke="#22345a" strokeWidth="0.5" />
              ))}
              {/* Floor */}
              <path d="M0 80 Q45 72 90 80 L90 130 L0 130 Z" fill="#14203a" />
              {[86, 94, 104, 116].map((y) => (
                <path key={y} d={`M0 ${y} Q45 ${y - 6} 90 ${y}`} fill="none" stroke="#1f2e4f" strokeWidth="0.45" />
              ))}
              {[-30, -15, 0, 15, 30].map((dx) => (
                <line key={dx} x1={45 + dx * 0.6} y1="76" x2={45 + dx * 2.2} y2="130" stroke="#1f2e4f" strokeWidth="0.45" />
              ))}
            </svg>

            <Knight side="left" player={guards.left} />
            <Knight side="right" player={guards.right} />

            {/* Throne */}
            <svg viewBox="0 0 100 140" className="absolute left-1/2 top-[11%] w-[50%] -translate-x-1/2" aria-hidden>
              <g stroke="#0b1324" strokeWidth="2" strokeLinejoin="round">
                <path d="M22 6 L50 0 L78 6 L80 96 L20 96 Z" fill="#33405a" />
                <path d="M30 14 L50 9 L70 14 L71 90 L29 90 Z" fill="#2a3550" />
                <rect x="10" y="84" width="80" height="14" rx="3" fill="#3a4865" />
                <rect x="6" y="70" width="16" height="44" rx="3" fill="#3a4865" />
                <rect x="78" y="70" width="16" height="44" rx="3" fill="#3a4865" />
                <rect x="14" y="98" width="72" height="34" fill="#2e3a55" />
                <rect x="0" y="130" width="100" height="10" rx="2" fill="#24304a" />
              </g>
              <path d="M30 22 Q36 18 40 26 Q34 30 30 22 Z" fill="#3fae8a" opacity="0.55" />
              <path d="M66 60 Q72 56 74 64 Q68 68 66 60 Z" fill="#3fae8a" opacity="0.5" />
            </svg>

            {/* The ruler */}
            {ruler ? (
              <div className="absolute left-1/2 top-[19%] flex w-[30%] -translate-x-1/2 flex-col items-center">
                <Crown className="relative z-20 -mb-[12%] h-auto w-[52%] fill-[#f5c84c] text-[#b8860b] drop-shadow-[0_0_10px_rgba(245,200,76,0.6)]" aria-hidden />
                <Head
                  player={ruler}
                  className="relative z-10 aspect-square w-[62%] rounded-full ring-4 ring-[#f5c84c] text-[min(4vw,18px)] shadow-[0_0_30px_rgba(245,200,76,0.35)]"
                />
                {/* Robe */}
                <svg viewBox="0 0 100 90" className="-mt-[6%] w-[130%]" aria-hidden>
                  <path d="M30 4 L70 4 L96 86 L4 86 Z" fill="#9db7d6" stroke="#0b1324" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M50 4 L50 86" stroke="#0b1324" strokeWidth="1.5" opacity="0.4" />
                  <path d="M30 4 L50 30 L70 4" fill="none" stroke="#0b1324" strokeWidth="2" />
                </svg>
              </div>
            ) : (
              <p className="absolute left-1/2 top-[34%] -translate-x-1/2 text-sm font-semibold text-slate-300">The throne is empty</p>
            )}

            {/* The kneeling */}
            {kneeling.map((player, i) => (
              <Kneeler key={player.id} player={player} spot={SPOTS[i]} cloak={CLOAKS[i % CLOAKS.length]} />
            ))}
          </div>

          {/* Caption */}
          <figcaption className="space-y-1 border-t border-slate-800 bg-slate-950 px-5 py-4 text-center">
            {ruler ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c84c]">All hail the #1</p>
                <p className="text-xl font-black text-white">{nameOf(ruler)}</p>
                <p className="font-mono text-xs text-slate-400">
                  {formatRating(ruler.skill_rating)} rating · {ruler.games_won}-{ruler.games_lost} · {ruler.games_played} games
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-300">No one is ranked yet. Play ranked games to claim the throne.</p>
            )}
          </figcaption>
        </figure>
      </div>
    </Modal>
  );
}
