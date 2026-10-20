"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { correctMatchResult } from "@/features/matches/api/matchActions";
import { describeRule, resultOnlyScore, type ScoringRule, type ScoringTeam } from "@/features/matches/utils/scoring";

export interface EditableMatch {
  id: string;
  team_a_score: number;
  team_b_score: number;
  teamA: string[];
  teamB: string[];
}

/** Admin dialog to correct a saved game. Ratings and wins follow on the server. */
export function EditResultModal({ match, rule, onClose }: { match: EditableMatch; rule: ScoringRule; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scoreA, setScoreA] = useState(String(match.team_a_score ?? 0));
  const [scoreB, setScoreB] = useState(String(match.team_b_score ?? 0));
  const [winner, setWinner] = useState<ScoringTeam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isResultOnly = rule.trackScores === false;

  function save() {
    setError(null);
    const final = isResultOnly
      ? winner
        ? resultOnlyScore(winner)
        : null
      : { scoreA: Number(scoreA), scoreB: Number(scoreB) };
    if (!final) {
      setError("Pick the team that won.");
      return;
    }
    startTransition(async () => {
      const res = await correctMatchResult(match.id, final.scoreA, final.scoreB);
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  const team = (label: string, names: string[]) => (
    <span className="block text-left">
      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{names.join(" & ")}</span>
    </span>
  );

  return (
    <Modal isOpen onClose={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl cursor-default">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Fix result</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ratings and wins update to match. This session plays {describeRule(rule)}.
          </p>
        </div>

        {isResultOnly ? (
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => setWinner(side)}
                aria-pressed={winner === side}
                className={`min-h-16 rounded-xl border-2 p-3 cursor-pointer ${
                  winner === side
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {team(side === "A" ? "Team 1 won" : "Team 2 won", side === "A" ? match.teamA : match.teamB)}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {([
              ["Team 1", match.teamA, scoreA, setScoreA],
              ["Team 2", match.teamB, scoreB, setScoreB],
            ] as const).map(([label, names, value, setValue]) => (
              <label key={label} className="flex items-center justify-between gap-3">
                {team(label, [...names])}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-label={`${label} score`}
                  className="h-11 w-20 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-center font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100"
                />
              </label>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="h-11 cursor-pointer">
            Cancel
          </Button>
          <Button type="button" variant="volt" onClick={save} disabled={isPending} className="h-11 font-bold cursor-pointer">
            {isPending ? "Saving…" : "Save correction"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
