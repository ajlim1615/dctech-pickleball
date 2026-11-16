"use client";

import { Crown, Eye } from "lucide-react";
import { formatRating } from "@/lib/utils";
import type { RankedPlayer } from "../api/rankingActions";

/** Metal finishes for the three podium places. */
const PLACES = {
  1: {
    label: "Gold",
    metal: "linear-gradient(135deg, #fff3b0 0%, #f5c84c 35%, #c8961e 70%, #f9e08a 100%)",
    text: "#5c3d00",
    step: "linear-gradient(180deg, rgba(245,200,76,0.35) 0%, rgba(245,200,76,0.08) 60%, rgba(15,23,42,0) 100%)",
    stepBorder: "rgba(245,200,76,0.55)",
    glow: "radial-gradient(closest-side, rgba(245,200,76,0.35), rgba(212,233,56,0.12) 55%, transparent)",
    height: "h-20 sm:h-44",
    avatar: "h-16 w-16 sm:h-28 sm:w-28",
  },
  2: {
    label: "Silver",
    metal: "linear-gradient(135deg, #ffffff 0%, #d7dde6 35%, #8f9bab 70%, #eef1f5 100%)",
    text: "#273142",
    step: "linear-gradient(180deg, rgba(203,213,225,0.28) 0%, rgba(203,213,225,0.06) 60%, rgba(15,23,42,0) 100%)",
    stepBorder: "rgba(203,213,225,0.45)",
    glow: null,
    height: "h-14 sm:h-32",
    avatar: "h-14 w-14 sm:h-20 sm:w-20",
  },
  3: {
    label: "Bronze",
    metal: "linear-gradient(135deg, #ffd9b3 0%, #d98b4a 35%, #8a4b20 70%, #f0b27a 100%)",
    text: "#4a2208",
    step: "linear-gradient(180deg, rgba(217,139,74,0.3) 0%, rgba(217,139,74,0.07) 60%, rgba(15,23,42,0) 100%)",
    stepBorder: "rgba(217,139,74,0.5)",
    glow: null,
    height: "h-10 sm:h-24",
    avatar: "h-14 w-14 sm:h-20 sm:w-20",
  },
} as const;

type Place = 1 | 2 | 3;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "P";
}

function Finisher({
  player,
  place,
  delay,
  onView,
  onPhoto,
}: {
  player: RankedPlayer;
  place: Place;
  delay: number;
  onView: (p: RankedPlayer) => void;
  onPhoto: (p: RankedPlayer) => void;
}) {
  const p = PLACES[place];
  const name = player.full_name || player.display_name || "Player";
  const losses = Math.max(0, (player.games_played || 0) - (player.games_won || 0));

  return (
    <li className={`flex flex-col items-center ${place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3"}`}>
      {/* The finisher */}
      <div className="podium-player relative flex flex-col items-center text-center px-1" style={{ animationDelay: `${delay + 350}ms` }}>
        {p.glow && (
          <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 h-56 w-56 -translate-x-1/2" style={{ background: p.glow }} />
        )}
        {place === 1 && <Crown className="relative mb-1 h-5 w-5 sm:h-7 sm:w-7 text-[#f5c84c]" strokeWidth={2.2} aria-hidden />}

        <div className="relative">
          {/* Metal ring */}
          <div className={`rounded-full p-[3px] ${place === 1 ? "shadow-[0_0_32px_rgba(245,200,76,0.45)]" : "shadow-lg"}`} style={{ background: p.metal }}>
            {player.avatar_url ? (
              <button
                type="button"
                onClick={() => onPhoto(player)}
                title="View photo"
                aria-label={`View ${name}'s photo`}
                className={`${p.avatar} block rounded-full overflow-hidden bg-slate-900 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4e938]`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
              </button>
            ) : (
              <div className={`${p.avatar} flex items-center justify-center rounded-full bg-slate-900 font-mono text-base sm:text-xl font-bold text-slate-100`}>
                {initials(name)}
              </div>
            )}
          </div>
          {/* Medal */}
          <span
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-mono text-xs font-black shadow-md ring-2 ring-slate-950"
            style={{ background: p.metal, color: p.text }}
            aria-label={`${p.label}, rank ${place}`}
          >
            {place}
          </span>
        </div>

        {/* The name opens their stats too (the only way on phones, where the button is hidden) */}
        <button
          type="button"
          onClick={() => onView(player)}
          className={`mt-4 font-bold text-white leading-tight line-clamp-2 hover:underline underline-offset-4 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-[#d4e938] ${
            place === 1 ? "text-sm sm:text-lg" : "text-xs sm:text-base"
          }`}
        >
          {name}
        </button>
        <p className={`mt-1 font-mono font-black tabular-nums ${place === 1 ? "text-xl sm:text-3xl text-[#d4e938]" : "text-base sm:text-xl text-slate-100"}`}>
          {formatRating(player.skill_rating)}
        </p>
        <p className="font-mono text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
          {player.games_won}W {losses}L · {player.win_rate}%
        </p>
        <button
          type="button"
          onClick={() => onView(player)}
          className="mt-2 max-sm:hidden inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:border-white/30 focus-visible:outline-2 focus-visible:outline-[#d4e938] cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          View stats
        </button>
      </div>

      {/* The step */}
      <div
        className={`podium-step mt-4 w-full ${p.height} rounded-t-2xl border-x border-t flex items-start justify-center pt-2 sm:pt-3`}
        style={{ background: p.step, borderColor: p.stepBorder, animationDelay: `${delay}ms` }}
        aria-hidden
      >
        <span
          className="font-black leading-none select-none text-3xl sm:text-6xl"
          style={{ backgroundImage: p.metal, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
        >
          {place}
        </span>
      </div>
    </li>
  );
}

/** The top three on stepped podium blocks: 2 · 1 · 3, with 1st raised and lit. */
export function RankingsPodium({
  top,
  totalPlayers,
  onView,
  onPhoto,
}: {
  top: RankedPlayer[];
  totalPlayers: number;
  onView: (p: RankedPlayer) => void;
  onPhoto: (p: RankedPlayer) => void;
}) {
  const noGamesYet = top.every((p) => (p.games_played || 0) === 0);
  // Rise order: 3rd, 2nd, then 1st last for the payoff.
  const delays: Record<Place, number> = { 3: 0, 2: 150, 1: 300 };

  return (
    <section
      aria-labelledby="podium-heading"
      className="relative overflow-hidden rounded-[2rem] border border-slate-800/80 bg-slate-950 px-4 pt-6 sm:px-10 sm:pt-8 text-white shadow-2xl"
      style={{
        backgroundImage:
          "radial-gradient(60% 55% at 50% 0%, rgba(212,233,56,0.14), transparent 70%), radial-gradient(40% 40% at 15% 100%, rgba(16,185,129,0.12), transparent 70%), linear-gradient(180deg, #0b1220 0%, #050912 100%)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 id="podium-heading" className="text-3xl sm:text-4xl font-black tracking-tight">
            Rankings
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalPlayers} players. Ratings move after every ranked game; casual games don&apos;t count.
          </p>
        </div>
      </div>

      <ol className="mt-8 grid grid-cols-3 items-end gap-x-2 sm:gap-x-6 max-w-3xl mx-auto">
        {/* DOM order 1, 2, 3 for screen readers; shown 2 · 1 · 3 like a real podium */}
        {top.map((player, i) => {
          const place = (i + 1) as Place;
          return (
            <Finisher key={player.id} player={player} place={place} delay={delays[place]} onView={onView} onPhoto={onPhoto} />
          );
        })}
      </ol>

      {noGamesYet && (
        <p className="relative -mx-4 sm:-mx-10 border-t border-white/10 bg-black/20 px-4 py-2.5 text-center text-xs text-slate-400">
          No ranked games yet, so everyone is tied at the start. The podium fills in after the first ranked game.
        </p>
      )}
    </section>
  );
}
