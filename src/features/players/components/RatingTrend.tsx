"use client";

import { useMemo, useState } from "react";
import { formatPHTDate } from "@/lib/timezone";
import { formatRating } from "@/lib/utils";
import type { PlayerRatingHistory } from "@/types";

const W = 320;
const H = 96;
const PAD = { top: 10, right: 10, bottom: 10, left: 34 };
// Brand emerald, validated for contrast and lightness on both light and dark surfaces.
const LINE = "#059669";

interface Point {
  rating: number;
  change: number;
  date: string | null;
}

/** A player's rating over their ranked games: one line, latest value marked, hover for detail. */
export function RatingTrend({ history, currentRating }: { history: PlayerRatingHistory[]; currentRating: number }) {
  const points: Point[] = useMemo(() => {
    if (history.length === 0) return [];
    return [
      { rating: Number(history[0].old_rating), change: 0, date: null },
      ...history.map((h) => ({ rating: Number(h.new_rating), change: Number(h.rating_change), date: h.recorded_at })),
    ];
  }, [history]);
  const [hover, setHover] = useState<number | null>(null);

  const last = history[history.length - 1];
  const lastChange = last ? Number(last.rating_change) : 0;

  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
        <RatingHeadline rating={currentRating} />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Play ranked games to see how your rating moves.
        </p>
      </div>
    );
  }

  const ratings = points.map((p) => p.rating);
  const lo = Math.floor((Math.min(...ratings) - 0.05) * 10) / 10;
  const hi = Math.ceil((Math.max(...ratings) + 0.05) * 10) / 10;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (r: number) => PAD.top + (1 - (r - lo) / Math.max(0.1, hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ");
  const active = hover !== null ? points[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <RatingHeadline rating={currentRating} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <span
            className={`font-mono font-semibold tabular-nums ${
              lastChange > 0 ? "text-emerald-700 dark:text-emerald-400" : lastChange < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {lastChange > 0 ? "+" : ""}
            {lastChange.toFixed(2)}
          </span>{" "}
          last game
        </p>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-28 w-full touch-none"
          role="img"
          aria-label={`Rating over your last ${history.length} ranked games, from ${formatRating(points[0].rating)} to ${formatRating(currentRating)}`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Recessive axis: just the range */}
          {[hi, lo].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-slate-500 dark:fill-slate-400 text-[10px] tabular-nums">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active && hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1} strokeDasharray="2 3" />
          )}
          {/* Latest value, or the hovered one, with a surface ring */}
          <circle
            cx={x(hover ?? points.length - 1)}
            cy={y((active ?? points[points.length - 1]).rating)}
            r={4.5}
            fill={LINE}
            className="stroke-white dark:stroke-slate-900"
            strokeWidth={2}
          />
        </svg>

        {active && hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-md whitespace-nowrap"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatRating(active.rating)}</span>
            {active.date ? (
              <span className="text-slate-500 dark:text-slate-400">
                {" "}
                ({active.change > 0 ? "+" : ""}
                {active.change.toFixed(2)}), {formatPHTDate(active.date)}
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400"> starting rating</span>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {history.length} ranked {history.length === 1 ? "game" : "games"}. Hover or tap the line for each game.
      </p>

      {/* Same data as a table for screen readers */}
      <table className="sr-only">
        <caption>Rating after each ranked game</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Rating</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id}>
              <td>{formatPHTDate(h.recorded_at)}</td>
              <td>{formatRating(Number(h.new_rating))}</td>
              <td>{Number(h.rating_change).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RatingHeadline({ rating }: { rating: number }) {
  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">Your rating</p>
      <p className="font-mono text-4xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
        {formatRating(rating)}
      </p>
    </div>
  );
}
