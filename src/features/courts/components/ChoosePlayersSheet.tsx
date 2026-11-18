"use client";

import { useReducer } from "react";
import { X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { IconButton } from "@/components/ui/icon-button";
import { chooseSlotsReducer } from "@/features/courts/utils/courtRules";
import { playerName } from "@/features/queue/components/PlayerPickerSheet";
import type { QueueEntryWithPlayer } from "@/types";

/** Fill Team 1 and Team 2 by tapping players from the line, then start the game. */
export function ChoosePlayersSheet({
  courtName,
  candidates,
  perSide,
  pending,
  onFill,
  onClose,
}: {
  courtName: string;
  candidates: QueueEntryWithPlayer[];
  perSide: 1 | 2;
  pending: boolean;
  onFill: (teamA: string[], teamB: string[]) => void;
  onClose: () => void;
}) {
  const [state, dispatch] = useReducer(chooseSlotsReducer, { teamA: [], teamB: [], active: "team_a", perSide });
  const nameOf = (id: string) => playerName(candidates.find((c) => c.player_id === id)?.player);
  const full = state.teamA.length === perSide && state.teamB.length === perSide;
  const picked = new Set([...state.teamA, ...state.teamB]);
  const ordered = [...candidates].sort((a, b) => (a.joined_at < b.joined_at ? -1 : 1));

  const team = (key: "teamA" | "teamB", label: string, active: boolean, tone: string) => (
    <div className={`min-w-0 rounded-xl border p-2 ${active ? tone : "border-slate-200 dark:border-slate-800"}`}>
      <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {active ? "▸ " : ""}
        {label}
      </p>
      <ul className="space-y-1">
        {Array.from({ length: perSide }, (_, i) => state[key][i]).map((id, i) => (
          <li key={i} className="flex min-h-11 min-w-0 items-center justify-between gap-1 rounded-lg bg-slate-50 dark:bg-slate-900 pl-2 pr-0.5 text-sm">
            {id ? (
              <>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">{nameOf(id)}</span>
                <IconButton
                  label={`Remove ${nameOf(id)}`}
                  onClick={() => dispatch({ type: "clear", playerId: id })}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </>
            ) : (
              <span className="text-slate-400">Empty</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Sheet
      title={courtName}
      onClose={onClose}
      size="md"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!full || pending}
            onClick={() => onFill(state.teamA, state.teamB)}
            className="min-h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            {pending ? "Starting…" : "Fill Court"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {team("teamA", "Team 1", state.active === "team_a", "border-emerald-500")}
          {team("teamB", "Team 2", state.active === "team_b", "border-sky-500")}
        </div>
        <ul className="space-y-1.5">
          {ordered.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No one is waiting.</li>}
          {ordered.map((c) => {
            const inA = state.teamA.includes(c.player_id);
            const inB = state.teamB.includes(c.player_id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: picked.has(c.player_id) ? "clear" : "pick", playerId: c.player_id })}
                  aria-pressed={inA || inB}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                    inA
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : inB
                        ? "border-sky-500 bg-sky-600 text-white"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:border-emerald-500"
                  }`}
                >
                  <span className="truncate font-semibold">{playerName(c.player)}</span>
                  {c.group_id && <span className="shrink-0 text-xs opacity-80">paired</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
