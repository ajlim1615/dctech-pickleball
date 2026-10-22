import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { describeRule, quickWinScore } from "@/features/matches/utils/scoring";
import { scoringRule } from "../engine/game";
import type { DeskGame, DeskSession, GameResult, Team } from "../engine/types";
import { Button, Sheet } from "./ui";

/** Record (or fix) a game's result: tap the winner, or enter the score. */
export function ResultSheet({
  session,
  game,
  names,
  title,
  onSubmit,
  onCancel,
}: {
  session: DeskSession;
  game: DeskGame;
  names: (id: string) => string;
  title: string;
  onSubmit: (result: GameResult) => void;
  onCancel: () => void;
}) {
  const rule = scoringRule(session);
  const [a, setA] = useState(game.endedAt && session.trackScores ? (game.scoreA ?? 0) : 0);
  const [b, setB] = useState(game.endedAt && session.trackScores ? (game.scoreB ?? 0) : 0);
  const team = (t: Team) => (t === "A" ? game.teamA : game.teamB).map(names).join(" & ");

  if (!session.trackScores) {
    return (
      <Sheet title={title} onClose={onCancel}>
        <p className="mb-4 text-sm text-muted-foreground">Who won?</p>
        <div className="grid grid-cols-2 gap-3">
          <WinnerButton team="A" label={team("A")} onClick={() => onSubmit({ winner: "A" })} />
          <WinnerButton team="B" label={team("B")} onClick={() => onSubmit({ winner: "B" })} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={title} onClose={onCancel}>
      <p className="mb-4 text-sm text-muted-foreground">
        Scoring: {describeRule(rule)}. Enter the score, or enter the losing team's points and tap who won.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <ScoreStepper team="A" label={team("A")} value={a} onChange={setA} />
        <ScoreStepper team="B" label={team("B")} value={b} onChange={setB} />
        <WinnerButton team="A" label="Team 1 won" onClick={() => onSubmit(quickWinScore("A", a, b, rule))} />
        <WinnerButton team="B" label="Team 2 won" onClick={() => onSubmit(quickWinScore("B", a, b, rule))} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSubmit({ scoreA: a, scoreB: b })}>
          Save <span className="font-mono tabular-nums">{a} - {b}</span>
        </Button>
      </div>
    </Sheet>
  );
}

function WinnerButton({ team, label, onClick }: { team: Team; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 rounded-lg border px-3 text-sm font-semibold ${
        team === "A" ? "border-team1/50 bg-team1/10 text-team1" : "border-team2/50 bg-team2/10 text-team2"
      }`}
    >
      {label}
    </button>
  );
}

function ScoreStepper({
  team,
  label,
  value,
  onChange,
}: {
  team: Team;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className={`mb-2 truncate text-sm font-medium ${team === "A" ? "text-team1" : "text-team2"}`}>{label}</p>
      <div className="flex items-center justify-between gap-2">
        <Button onClick={() => onChange(Math.max(0, value - 1))} aria-label="Minus one" className="px-3">
          <Minus size={18} />
        </Button>
        <span className="font-mono text-4xl font-bold tabular-nums">{value}</span>
        <Button onClick={() => onChange(value + 1)} aria-label="Plus one" className="px-3">
          <Plus size={18} />
        </Button>
      </div>
    </div>
  );
}
