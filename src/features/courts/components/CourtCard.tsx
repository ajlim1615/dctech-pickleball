"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, Plus, Minus, CheckCircle2, Zap, RotateCcw, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finalizeMatch } from "@/features/matches/api/matchActions";
import { callNextUp } from "@/features/queue/api/queueActions";
import {
  describeRule,
  getWinner,
  quickWinScore,
  resultOnlyScore,
  type ScoringRule,
  type ScoringTeam,
} from "@/features/matches/utils/scoring";
import type { ActiveCourtView, Profile } from "@/types";

export function CourtDurationClock({ startedAt }: { startedAt?: string | null }) {
  const [elapsed, setElapsed] = useState<string>("00:00");

  useEffect(() => {
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now();
    const tick = () => {
      const diffSecs = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const mins = Math.floor(diffSecs / 60).toString().padStart(2, "0");
      const secs = (diffSecs % 60).toString().padStart(2, "0");
      setElapsed(`${mins}:${secs}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className="font-mono tabular-nums font-medium">{elapsed}</span>;
}

export interface CourtCardProps {
  court: ActiveCourtView;
  sessionId?: string;
  waitingQueueCount?: number;
  userRole?: string;
  isAdmin?: boolean;
  readOnly?: boolean;
  targetPoints?: number;
  /** When true, submitting a result immediately calls the next group onto this court. */
  autoFill?: boolean;
  /** Session rule: must a team lead by 2? Defaults to true at 11 pts, false at 6. */
  winByTwo?: boolean;
  /** false: win/loss-only session, the admin just picks the winning team. */
  trackScores?: boolean;
}

export function CourtCard({
  court,
  sessionId,
  waitingQueueCount = 0,
  userRole = "player",
  isAdmin,
  readOnly = false,
  targetPoints = 11,
  autoFill = true,
  winByTwo,
  trackScores = true,
}: CourtCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isAdministrator = !readOnly && (isAdmin ?? (userRole === "admin"));

  // The session decides the scoring rule; courts never override it.
  const courtTargetPoints = targetPoints || 11;
  const rule: ScoringRule = {
    targetPoints: courtTargetPoints,
    winByTwo: winByTwo ?? courtTargetPoints !== 6,
    trackScores,
  };
  // Win/loss-only sessions: the team the admin tapped, waiting for confirmation.
  const [pendingWinner, setPendingWinner] = useState<ScoringTeam | null>(null);

  const activeMatch = court.current_match;
  const isExistingLiveMatch = Boolean(
    court.status === "occupied" && activeMatch && activeMatch.status === "in_progress"
  );

  // Score states
  const [scoreA, setScoreA] = useState<number>(activeMatch?.team_a_score || 0);
  const [scoreB, setScoreB] = useState<number>(activeMatch?.team_b_score || 0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync state if activeMatch changes
  useEffect(() => {
    if (activeMatch) {
      setScoreA(activeMatch.team_a_score || 0);
      setScoreB(activeMatch.team_b_score || 0);
    } else {
      setScoreA(0);
      setScoreB(0);
    }
  }, [activeMatch]);

  // Extract players currently in active match
  const activeTeamAPlayers: Profile[] =
    activeMatch?.players
      ?.filter((p) => p.team === "team_a")
      ?.map((p) => ((p as any).player || (p as any).profile || p) as Profile)
      ?.filter((p): p is Profile => Boolean(p && p.id)) || [];

  const activeTeamBPlayers: Profile[] =
    activeMatch?.players
      ?.filter((p) => p.team === "team_b")
      ?.map((p) => ((p as any).player || (p as any).profile || p) as Profile)
      ?.filter((p): p is Profile => Boolean(p && p.id)) || [];

  const hasPlayersOnCourt =
    isExistingLiveMatch &&
    activeTeamAPlayers.length > 0 &&
    activeTeamBPlayers.length > 0;

  function incrementScore(team: "A" | "B") {
    if (!isAdministrator) return;
    if (team === "A") setScoreA((prev) => prev + 1);
    else setScoreB((prev) => prev + 1);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
  }

  function decrementScore(team: "A" | "B") {
    if (!isAdministrator) return;
    if (team === "A") setScoreA((prev) => Math.max(0, prev - 1));
    else setScoreB((prev) => Math.max(0, prev - 1));
  }

  function handleQuickWin(team: "A" | "B") {
    if (!isAdministrator) return;
    // Smallest valid final score: 10-10 becomes 12-10 with win by 2, or 11-10 without.
    const final = quickWinScore(team, scoreA, scoreB, rule);
    setScoreA(final.scoreA);
    setScoreB(final.scoreB);
  }

  /** Preview of the score Quick Win would set, e.g. "12-10". */
  function quickWinLabel(team: ScoringTeam) {
    const final = quickWinScore(team, scoreA, scoreB, rule);
    return `${final.scoreA}-${final.scoreB}`;
  }

  function handleResetScore() {
    if (!isAdministrator) return;
    setScoreA(0);
    setScoreB(0);
  }

  function handleAutoCallQueue() {
    if (!isAdministrator || isPending) return;
    if (!sessionId) {
      setErrorMessage("No active session found. Please start a session first.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await callNextUp(sessionId, court.id, 4);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage("Next group called onto this court.");
        router.refresh();
      }
    });
  }

  // Victory condition follows the session rule (win by 2, or first to target)
  const winningTeam = getWinner(scoreA, scoreB, rule);
  const isGameOver = winningTeam !== null;
  const winner = winningTeam === "A" ? "Team 1" : winningTeam === "B" ? "Team 2" : null;

  function handleSubmitScore(finalA = scoreA, finalB = scoreB) {
    if (!isAdministrator || isPending) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!hasPlayersOnCourt || !activeMatch) {
      setErrorMessage("Cannot submit score: No players or active match on this court.");
      return;
    }

    if (!getWinner(finalA, finalB, rule)) {
      setErrorMessage(
        `Cannot submit match: Score is not finished yet. This session plays ${describeRule(rule)}.`
      );
      return;
    }

    const saved = rule.trackScores === false
      ? `${finalA > finalB ? "Team 1" : "Team 2"} win`
      : `${finalA}-${finalB}`;

    startTransition(async () => {
      const res = await finalizeMatch(activeMatch.id, finalA, finalB, { autoFill });
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(
          res?.autoFilled
            ? `Saved ${saved}. Players re-queued and the next group is on court.`
            : `Saved ${saved}. Players are back in the queue.${
                autoFill && res?.autoFillMessage ? ` Court left open: ${res.autoFillMessage}` : ""
              }`
        );
        setScoreA(0);
        setScoreB(0);
        setPendingWinner(null);
        router.refresh();
      }
    });
  }

  /** Win/loss-only sessions: record the tapped team's win once confirmed. */
  function handleConfirmResult() {
    if (!pendingWinner) return;
    const final = resultOnlyScore(pendingWinner);
    handleSubmitScore(final.scoreA, final.scoreB);
  }

  const cleanCourtName = court.name.replace(/\s*\(Rented Court\)/i, "");

  const isClosed = court.status === "maintenance" || court.status === "reserved";
  const canScore = isAdministrator && hasPlayersOnCourt && trackScores;
  const canPickWinner = isAdministrator && hasPlayersOnCourt && !trackScores;

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-white dark:bg-slate-900/70 shadow-sm ${
        isClosed ? "border-slate-200 dark:border-slate-800 opacity-70" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {/* Header: court name, state, umpire shortcut */}
      <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {cleanCourtName}
          </h3>
          <CourtStateLabel
            state={isClosed ? court.status : hasPlayersOnCourt ? "in_play" : "open"}
            startedAt={activeMatch?.started_at}
          />
        </div>
        {isAdministrator && !isClosed && (
          <Link
            href={`/courts/${court.id}/monitor`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500"
            title={`Open the full-screen umpire view for ${cleanCourtName}`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Umpire</span>
          </Link>
        )}
      </header>

      {/* The court itself, seen from above: Team 1 | net | Team 2 */}
      <div className="px-4">
        <div
          className={`relative grid grid-cols-[1fr_6px_1fr] overflow-hidden rounded-xl border-2 ${
            isClosed
              ? "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60"
              : "border-slate-300/90 dark:border-slate-600/70 bg-slate-50 dark:bg-slate-950/60"
          }`}
        >
          <CourtHalf
            side="A"
            label="Team 1"
            players={activeTeamAPlayers}
            score={scoreA}
            showScore={hasPlayersOnCourt && trackScores}
            isWinner={winningTeam === "A" || pendingWinner === "A"}
            closed={isClosed}
            canScore={canScore}
            onPlus={() => incrementScore("A")}
            onMinus={() => decrementScore("A")}
            plusDisabled={isGameOver || isPending}
            minusDisabled={scoreA === 0 || isPending}
            pickWinner={canPickWinner ? () => setPendingWinner("A") : undefined}
            pickDisabled={isPending}
          />

          {/* Net */}
          <div aria-hidden className="relative bg-slate-300 dark:bg-slate-600">
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/70 dark:bg-slate-400/60" />
          </div>

          <CourtHalf
            side="B"
            label="Team 2"
            players={activeTeamBPlayers}
            score={scoreB}
            showScore={hasPlayersOnCourt && trackScores}
            isWinner={winningTeam === "B" || pendingWinner === "B"}
            closed={isClosed}
            canScore={canScore}
            onPlus={() => incrementScore("B")}
            onMinus={() => decrementScore("B")}
            plusDisabled={isGameOver || isPending}
            minusDisabled={scoreB === 0 || isPending}
            pickWinner={canPickWinner ? () => setPendingWinner("B") : undefined}
            pickDisabled={isPending}
          />

          {isClosed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/90 dark:bg-slate-900/90 px-3 py-1 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
                {court.status === "maintenance" ? "Closed for maintenance" : "Reserved"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {(errorMessage || successMessage) && (
        <div className="px-4 pt-3">
          {errorMessage ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {errorMessage}
            </p>
          ) : (
            <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              {successMessage}
            </p>
          )}
        </div>
      )}

      {/* Footer: the one thing to do next on this court */}
      <footer className="mt-auto px-4 pt-3 pb-4 space-y-2.5">
        {isClosed ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAdministrator ? "Reopen it from Court setup on the Admin page." : "Not in use right now."}
          </p>
        ) : !isAdministrator ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {hasPlayersOnCourt
              ? isGameOver
                ? `Game over · ${winner} won`
                : `Game in progress · ${describeRule(rule)}`
              : "Open · the next 4 in the queue play here"}
          </p>
        ) : !hasPlayersOnCourt ? (
          <>
            <Button
              type="button"
              variant="volt"
              onClick={handleAutoCallQueue}
              disabled={isPending || waitingQueueCount < 4}
              className="w-full h-12 text-sm font-bold rounded-xl cursor-pointer disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              {isPending ? "Calling players…" : "Call next 4"}
            </Button>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              {waitingQueueCount >= 4
                ? `${waitingQueueCount} waiting in the queue`
                : `Needs 4 waiting players · ${waitingQueueCount} in the queue`}
            </p>
          </>
        ) : !trackScores ? (
          pendingWinner ? (
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Record a win for {pendingWinner === "A" ? "Team 1" : "Team 2"}?
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingWinner(null)} disabled={isPending} className="h-11 cursor-pointer">
                  Cancel
                </Button>
                <Button type="button" variant="volt" onClick={handleConfirmResult} disabled={isPending} className="h-11 font-bold cursor-pointer">
                  {isPending ? "Saving…" : "Record win"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Tap the side that won. No score needed.
            </p>
          )
        ) : (
          <>
            <Button
              type="button"
              variant={isGameOver ? "volt" : "outline"}
              onClick={() => handleSubmitScore()}
              disabled={isPending || !isGameOver}
              className="w-full h-12 text-sm font-bold rounded-xl cursor-pointer disabled:cursor-not-allowed"
            >
              <Trophy className="h-4 w-4 mr-1.5" />
              {isPending
                ? "Saving result…"
                : isGameOver
                ? `Submit result · ${winner} wins ${Math.max(scoreA, scoreB)}–${Math.min(scoreA, scoreB)}`
                : `Playing ${describeRule(rule)}`}
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {!isGameOver && (
                <>
                  <span>Quick win:</span>
                  <button type="button" onClick={() => handleQuickWin("A")} className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2 cursor-pointer">
                    Team 1 ({quickWinLabel("A")})
                  </button>
                  <button type="button" onClick={() => handleQuickWin("B")} className="font-semibold text-sky-700 dark:text-sky-400 hover:underline underline-offset-2 cursor-pointer">
                    Team 2 ({quickWinLabel("B")})
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleResetScore}
                disabled={scoreA === 0 && scoreB === 0}
                className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </>
        )}
      </footer>
    </article>
  );
}

type CourtState = "in_play" | "open" | ActiveCourtView["status"];

function CourtStateLabel({ state, startedAt }: { state: CourtState; startedAt?: string | null }) {
  if (state === "in_play") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        In play
        <CourtDurationClock startedAt={startedAt} />
      </span>
    );
  }
  if (state === "open" || state === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {state === "maintenance" ? "Closed" : state === "reserved" ? "Reserved" : "Busy"}
    </span>
  );
}

interface CourtHalfProps {
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
}

function CourtHalf({
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
        className={`pointer-events-none absolute inset-y-0 ${isA ? "right-0 border-l" : "left-0 border-r"} w-[22%] border-dashed border-slate-300 dark:border-slate-600/70 bg-slate-200/30 dark:bg-slate-800/30`}
      />
      <div className={`relative flex min-h-36 flex-col gap-2 p-3 ${isA ? "items-start text-left pr-[24%]" : "items-end text-right pl-[24%]"}`}>
        <span className={`text-xs font-semibold ${tone.text}`}>{label}</span>
        <ul className="space-y-0.5 min-w-0 max-w-full">
          {players.length > 0
            ? players.map((p) => (
                <li key={p.id} className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {p.full_name || p.display_name || "Player"}
                </li>
              ))
            : !closed &&
              [0, 1].map((i) => (
                <li key={i} className="text-sm text-slate-400 dark:text-slate-500">
                  Open spot
                </li>
              ))}
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
        className={`relative text-left transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${tone.ring} ${
          isWinner ? tone.win : `${tone.tint} hover:brightness-95 dark:hover:brightness-125`
        }`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`relative flex flex-col ${isWinner ? tone.win : closed ? "" : tone.tint}`}>
      {content}
      {canScore && (
        <div className={`relative flex gap-2 px-3 pb-3 ${isA ? "justify-start" : "justify-end"}`}>
          <button
            type="button"
            onClick={onMinus}
            disabled={minusDisabled}
            aria-label={`Remove a point from ${label}`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onPlus}
            disabled={plusDisabled}
            aria-label={`Add a point to ${label}`}
            className={`flex h-11 w-14 items-center justify-center rounded-lg text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
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
