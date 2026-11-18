"use client";

import { Minus, Plus, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import type { ScoringTeam } from "@/features/matches/utils/scoring";
import type { Profile } from "@/types";

export interface CourtHalfProps {
  side: ScoringTeam;
  label: string;
  players: Profile[];
  score: number;
  showScore: boolean;
  isWinner: boolean;
  closed: boolean;
  canScore: boolean;
  onPlus: () => void;
  onMinus: () => void;
  plusDisabled: boolean;
  minusDisabled: boolean;
  /** Win/loss sessions: the whole half is the "this team won" button. */
  pickWinner?: () => void;
  pickDisabled?: boolean;
  /** Players per side, so a removed player leaves an empty slot. */
  slots?: number;
  /** Admin live-court controls: tap a name, remove with the x, fill an empty slot. */
  onPlayerTap?: (player: Profile) => void;
  onRemove?: (player: Profile) => void;
  onAddSlot?: () => void;
}

export function CourtHalf({
  side,
  label,
  players,
  score,
  showScore,
  isWinner,
  closed,
  canScore,
  onPlus,
  onMinus,
  plusDisabled,
  minusDisabled,
  pickWinner,
  pickDisabled,
  slots = 2,
  onPlayerTap,
  onRemove,
  onAddSlot,
}: CourtHalfProps) {
  const isA = side === "A";
  const tone = isA
    ? {
        text: "text-emerald-700 dark:text-emerald-400",
        tint: "bg-emerald-50/70 dark:bg-emerald-950/25",
        win: "bg-emerald-100 dark:bg-emerald-900/40",
        ring: "ring-emerald-500",
      }
    : {
        text: "text-sky-700 dark:text-sky-400",
        tint: "bg-sky-50/70 dark:bg-sky-950/25",
        win: "bg-sky-100 dark:bg-sky-900/40",
        ring: "ring-sky-500",
      };

  const content = (
    <>
      {/* Kitchen (non-volley zone) beside the net */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 ${isA ? "right-0 border-l" : "left-0 border-r"} w-[10%] sm:w-[22%] border-dashed border-slate-300 dark:border-slate-600/70 bg-slate-200/30 dark:bg-slate-800/30`}
      />
      <div
        className={`relative flex min-h-36 w-full min-w-0 flex-col gap-2 p-2.5 sm:p-3 ${
          isA ? "items-start text-left pr-[12%] sm:pr-[24%]" : "items-end text-right pl-[12%] sm:pl-[24%]"
        }`}
      >
        <span className={`text-xs font-semibold ${tone.text}`}>{label}</span>
        <ul className="w-full min-w-0 max-w-full space-y-0.5">
          {players.length > 0
            ? players.map((p) => {
                const name = p.full_name || p.display_name || "Player";
                return (
                  <li key={p.id} className={`flex w-full min-w-0 max-w-full items-center gap-0.5 ${isA ? "" : "flex-row-reverse"}`}>
                    {onPlayerTap ? (
                      <button
                        type="button"
                        onClick={() => onPlayerTap(p)}
                        className={`min-h-11 min-w-0 flex-1 truncate rounded-md px-1 text-sm font-medium text-slate-900 dark:text-slate-100 underline-offset-2 hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                          isA ? "text-left" : "text-right"
                        }`}
                      >
                        {name}
                      </button>
                    ) : (
                      <span className={`min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100 ${isA ? "text-left" : "text-right"}`}>
                        {name}
                      </span>
                    )}
                    {onRemove && (
                      <IconButton
                        label={`Take ${name} off the court (back to the front of the line)`}
                        onClick={() => onRemove(p)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </li>
                );
              })
            : null}
          {!closed &&
            Array.from({ length: Math.max(0, (players.length > 0 || onAddSlot ? slots : 2) - players.length) }, (_, i) =>
              onAddSlot ? (
                <li key={`open-${i}`} className="w-full min-w-0 max-w-full">
                  <button
                    type="button"
                    onClick={onAddSlot}
                    className="min-h-11 w-full max-w-full truncate rounded-md border border-dashed border-slate-400 dark:border-slate-600 px-2 text-sm text-slate-600 dark:text-slate-300 hover:border-emerald-500 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
                  >
                    + Tap to add player
                  </button>
                </li>
              ) : (
                <li key={`open-${i}`} className="text-sm text-slate-400 dark:text-slate-500">
                  Open spot
                </li>
              )
            )}
        </ul>
        {showScore && (
          <div className={`mt-auto font-mono tabular-nums text-5xl font-bold leading-none ${tone.text}`}>
            {score}
          </div>
        )}
        {pickWinner && (
          <span className={`mt-auto text-sm font-bold ${tone.text}`}>{isWinner ? "Winner" : `${label} won`}</span>
        )}
      </div>
    </>
  );

  if (pickWinner) {
    return (
      <button
        type="button"
        onClick={pickWinner}
        disabled={pickDisabled}
        aria-pressed={isWinner}
        className={`relative min-w-0 text-left transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${tone.ring} ${
          isWinner ? tone.win : `${tone.tint} hover:brightness-95 dark:hover:brightness-125`
        }`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`relative flex min-w-0 flex-col ${isWinner ? tone.win : closed ? "" : tone.tint}`}>
      {content}
      {canScore && (
        <div className={`relative flex gap-2 px-2.5 pb-3 sm:px-3 ${isA ? "justify-start" : "justify-end"}`}>
          <button
            type="button"
            onClick={onMinus}
            disabled={minusDisabled}
            aria-label={`Remove a point from ${label}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onPlus}
            disabled={plusDisabled}
            aria-label={`Add a point to ${label}`}
            className={`flex h-11 w-14 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
              isA ? "bg-emerald-600 hover:bg-emerald-700" : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
