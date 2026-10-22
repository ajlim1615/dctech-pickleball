import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import clsx from "clsx";
import { describeRule, quickWinScore } from "@/features/matches/utils/scoring";
import { scoringRule } from "../engine/game";
import type { DeskGame, DeskSession, GameResult, Team } from "../engine/types";
import { Button, IconButton, Sheet } from "./ui";

/**
 * Record (or fix) a game's result: tap the winner, or enter the score.
 * `error` is shown inline, and each new `errorKey` gives the Save button a short shake.
 */
export function ResultSheet({
  session,
  game,
  courtName,
  names,
  title,
  error,
  errorKey = 0,
  onSubmit,
  onCancel,
}: {
  session: DeskSession;
  game: DeskGame;
  courtName: string;
  names: (id: string) => string;
  title: string;
  error?: string | null;
  errorKey?: number;
  onSubmit: (result: GameResult) => void;
  onCancel: () => void;
}) {
  const rule = scoringRule(session);
  const [a, setA] = useState(game.endedAt && session.trackScores ? (game.scoreA ?? 0) : 0);
  const [b, setB] = useState(game.endedAt && session.trackScores ? (game.scoreB ?? 0) : 0);
  const team = (t: Team) => (t === "A" ? game.teamA : game.teamB).map(names).join(" & ");
  const subtitle = `${courtName} · ${describeRule(rule)}`;

  if (!session.trackScores) {
    return (
      <Sheet title={title} subtitle={subtitle} onClose={onCancel} footer={<Button variant="ghost" onClick={onCancel}>Cancel</Button>}>
        <p className="mb-3 pt-1 text-[15px] text-muted">Who won?</p>
        <div className="grid grid-cols-2 gap-3 pb-2">
          <WinnerButton team="A" label={team("A")} onClick={() => onSubmit({ winner: "A" })} big />
          <WinnerButton team="B" label={team("B")} onClick={() => onSubmit({ winner: "B" })} big />
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={title}
      subtitle={subtitle}
      onClose={onCancel}
      footer={
        <>
          <WinnerButton team="A" label="Team 1 won" onClick={() => onSubmit(quickWinScore("A", a, b, rule))} />
          <WinnerButton team="B" label="Team 2 won" onClick={() => onSubmit(quickWinScore("B", a, b, rule))} />
          <span className="flex-1" />
          <motion.div
            key={errorKey}
            animate={errorKey ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
            transition={{ duration: 0.3 }}
          >
            <Button variant="primary" size="lg" onClick={() => onSubmit({ scoreA: a, scoreB: b })}>
              Save{" "}
              <span className="font-mono tabular-nums">
                {a} – {b}
              </span>
            </Button>
          </motion.div>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 pt-1">
        <ScorePanel team="A" label={team("A")} value={a} onChange={setA} />
        <ScorePanel team="B" label={team("B")} value={b} onChange={setB} />
      </div>
      <p className={clsx("mt-3 min-h-5 text-sm", error ? "text-clay" : "text-muted")} role={error ? "alert" : undefined}>
        {error ?? "Enter the score, or the losing team's points and tap who won."}
      </p>
    </Sheet>
  );
}

function WinnerButton({ team, label, onClick, big }: { team: Team; label: string; onClick: () => void; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-xl px-4 font-semibold transition active:scale-[0.98]",
        big ? "min-h-20 text-base" : "min-h-11 text-sm",
        team === "A" ? "bg-t1-bg text-t1" : "bg-t2-bg text-t2"
      )}
    >
      {label}
    </button>
  );
}

function ScorePanel({ team, label, value, onChange }: { team: Team; label: string; value: number; onChange: (v: number) => void }) {
  const isA = team === "A";
  return (
    <div className={clsx("rounded-2xl p-4", isA ? "bg-t1-bg" : "bg-t2-bg")}>
      <p className={clsx("truncate text-xs font-semibold uppercase tracking-[0.05em]", isA ? "text-t1" : "text-t2")}>
        {isA ? "Team 1" : "Team 2"} · <span className="normal-case tracking-normal">{label}</span>
      </p>
      <div className="mt-2 flex items-center justify-between">
        <IconButton label={`Team ${isA ? 1 : 2} minus one`} onClick={() => onChange(Math.max(0, value - 1))} className="bg-surface">
          <Minus size={18} />
        </IconButton>
        <span className={clsx("font-serif text-[44px] font-semibold leading-none tabular-nums", isA ? "text-t1" : "text-t2")}>{value}</span>
        <IconButton label={`Team ${isA ? 1 : 2} plus one`} onClick={() => onChange(value + 1)} className="bg-surface">
          <Plus size={18} />
        </IconButton>
      </div>
    </div>
  );
}
