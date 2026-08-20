"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Users,
  Plus,
  Minus,
  Check,
  CheckCircle2,
  Zap,
  Activity,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Clock,
  AlertCircle,
  Sparkles,
  UserCheck,
  ChevronRight,
  ExternalLink,
  PlusCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { finalizeMatch } from "../api/matchActions";
import { callNextUp } from "@/features/queue/api/queueActions";
import type { ActiveCourtView, Profile, QueueEntryWithPlayer } from "@/types";

interface ScoreRecorderProps {
  courts?: ActiveCourtView[];
  players?: Profile[];
  sessionId?: string;
  initialQueue?: QueueEntryWithPlayer[];
}

function CourtDurationClock({ startedAt }: { startedAt?: string | null }) {
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

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-700 dark:text-rose-400 shadow-2xs">
      <Clock className="h-3 w-3 text-rose-600 dark:text-rose-400 animate-pulse" />
      <span>⏱️ {elapsed}</span>
    </div>
  );
}

interface CourtCardProps {
  court: ActiveCourtView;
  sessionId?: string;
  waitingQueueCount: number;
}

function CourtCard({
  court,
  sessionId,
  waitingQueueCount,
}: CourtCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
    if (team === "A") setScoreA((prev) => prev + 1);
    else setScoreB((prev) => prev + 1);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
  }

  function decrementScore(team: "A" | "B") {
    if (team === "A") setScoreA((prev) => Math.max(0, prev - 1));
    else setScoreB((prev) => Math.max(0, prev - 1));
  }

  function handleQuickWin(team: "A" | "B") {
    if (team === "A") {
      setScoreA(11);
      setScoreB((prev) => (prev >= 10 ? 9 : prev));
    } else {
      setScoreB(11);
      setScoreA((prev) => (prev >= 10 ? 9 : prev));
    }
  }

  function handleResetScore() {
    setScoreA(0);
    setScoreB(0);
  }

  function handleAutoCallQueue() {
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
        setSuccessMessage("Next pod rotated from queue onto this court!");
        router.refresh();
      }
    });
  }

  // Standard Pickleball Victory Condition: 11 points and win by at least 2
  const isGameOver =
    (scoreA >= 11 && scoreA - scoreB >= 2) || (scoreB >= 11 && scoreB - scoreA >= 2);
  const winner = scoreA >= 11 && scoreA - scoreB >= 2 ? "Team 1" : scoreB >= 11 && scoreB - scoreA >= 2 ? "Team 2" : null;

  function handleSubmitScore() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!hasPlayersOnCourt || !activeMatch) {
      setErrorMessage("Cannot submit score: No players or active match on this court.");
      return;
    }

    if (!isGameOver) {
      setErrorMessage("Cannot submit match: Score is not finished yet. Pickleball games must reach at least 11 points and win by 2.");
      return;
    }

    startTransition(async () => {
      const res = await finalizeMatch(activeMatch.id, scoreA, scoreB);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(`Match completed! Final Score: ${scoreA} - ${scoreB}. Court is now ready for next rotation.`);
        setScoreA(0);
        setScoreB(0);
        router.refresh();
      }
    });
  }

  const cleanCourtName = court.name.replace(/\s*\(Rented Court\)/i, "");

  // Average ratings for live matchup
  const teamAAvg =
    activeTeamAPlayers.length > 0
      ? (
          activeTeamAPlayers.reduce((sum, p) => sum + (p.skill_rating || 3.0), 0) /
          activeTeamAPlayers.length
        ).toFixed(2)
      : "3.00";

  const teamBAvg =
    activeTeamBPlayers.length > 0
      ? (
          activeTeamBPlayers.reduce((sum, p) => sum + (p.skill_rating || 3.0), 0) /
          activeTeamBPlayers.length
        ).toFixed(2)
      : "3.00";

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-md backdrop-blur-md overflow-hidden flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700">
      {/* Court Header */}
      <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {cleanCourtName}
              </CardTitle>
              {isExistingLiveMatch ? (
                <Badge variant="default" className="text-[10px] py-0 font-mono">
                  🔴 IN PLAY
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] py-0 font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500/30">
                  🟢 READY / OPEN
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {court.surface_type || "Standard Court"} • Game to 11 (Win by 2)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isExistingLiveMatch && (
              <CourtDurationClock startedAt={activeMatch?.started_at} />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
        {/* Messages */}
        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* Court Body */}
        {isExistingLiveMatch ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
              <span className="uppercase flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Activity className="h-3.5 w-3.5" />
                Live Matchup ({activeMatch?.format === "singles" ? "1v1 Singles" : "2v2 Doubles"})
              </span>
              <span className="text-[10px] text-slate-400">Session Rotation Active</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              {/* Team 1 Box */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    TEAM 1
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Avg {teamAAvg}
                  </span>
                </div>
                <div className="space-y-1">
                  {activeTeamAPlayers.map((p, i) => (
                    <div
                      key={p.id || i}
                      className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-emerald-500/20 text-slate-900 dark:text-slate-100 shadow-2xs"
                    >
                      <span className="truncate max-w-[105px] text-[11px] font-semibold">
                        {p.full_name || p.display_name || "Player"}
                      </span>
                      <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono font-bold shrink-0">
                        {Number(p.skill_rating || 3.0).toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team 2 Box */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-50/40 dark:bg-sky-950/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                    TEAM 2
                  </span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                    Avg {teamBAvg}
                  </span>
                </div>
                <div className="space-y-1">
                  {activeTeamBPlayers.map((p, i) => (
                    <div
                      key={p.id || i}
                      className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-sky-500/20 text-slate-900 dark:text-slate-100 shadow-2xs"
                    >
                      <span className="truncate max-w-[105px] text-[11px] font-semibold">
                        {p.full_name || p.display_name || "Player"}
                      </span>
                      <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono font-bold shrink-0">
                        {Number(p.skill_rating || 3.0).toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {/* Court Empty / Ready for Queue Pod */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 space-y-3 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center sm:justify-start gap-1.5">
                    <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Call Next Rotation from Queue
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {waitingQueueCount > 0
                      ? `${waitingQueueCount} players in line • pulls next 4 & applies DUPR balanced matching`
                      : "Queue is currently empty. Players must check into the queue to rotate."}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="volt"
                  size="sm"
                  onClick={handleAutoCallQueue}
                  disabled={isPending || waitingQueueCount === 0}
                  className="font-mono text-xs font-bold shrink-0 h-9 px-4 shadow-sm"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  {isPending ? "Rotating..." : "Call Next 4"}
                </Button>
              </div>

              <div className="pt-1 border-t border-emerald-500/20 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <span>Rotations follow session matching rules (FIFO + DUPR balance).</span>
                <Link
                  href="/queue"
                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  Manage / Add Players in Queue <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Score Board & Steppers */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
              Live Score Board:
            </span>
            <button
              type="button"
              onClick={handleResetScore}
              disabled={!hasPlayersOnCourt}
              className="text-[10px] font-mono text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="h-2.5 w-2.5" /> Reset 0-0
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Team 1 Score */}
            <div className={`rounded-xl border-2 p-3 text-center space-y-1.5 shadow-2xs transition-all ${
              winner === "Team 1"
                ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30"
                : "border-emerald-500/30 bg-slate-50 dark:bg-slate-950/70"
            }`}>
              <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                TEAM 1 {winner === "Team 1" && "🏆 WINNER"}
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-600 dark:text-emerald-400 py-0.5">
                {scoreA}
              </div>
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => decrementScore("A")}
                  disabled={!hasPlayersOnCourt || scoreA === 0}
                  className="h-8 w-8 rounded-lg text-sm font-bold disabled:opacity-40"
                  title="Minus 1 point"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  onClick={() => incrementScore("A")}
                  disabled={!hasPlayersOnCourt || isGameOver}
                  className="h-8 w-8 rounded-lg text-sm font-bold shadow-sm shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={isGameOver ? "Game point reached (add disabled)" : "Add 1 point"}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Team 2 Score */}
            <div className={`rounded-xl border-2 p-3 text-center space-y-1.5 shadow-2xs transition-all ${
              winner === "Team 2"
                ? "border-sky-500 bg-sky-50/80 dark:bg-sky-950/60 ring-2 ring-sky-500/30"
                : "border-sky-500/30 bg-slate-50 dark:bg-slate-950/70"
            }`}>
              <span className="text-[10px] font-bold font-mono text-sky-600 dark:text-sky-400 uppercase tracking-wider block">
                TEAM 2 {winner === "Team 2" && "🏆 WINNER"}
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono text-sky-600 dark:text-sky-400 py-0.5">
                {scoreB}
              </div>
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => decrementScore("B")}
                  disabled={!hasPlayersOnCourt || scoreB === 0}
                  className="h-8 w-8 rounded-lg text-sm font-bold disabled:opacity-40"
                  title="Minus 1 point"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="volt"
                  size="icon"
                  onClick={() => incrementScore("B")}
                  disabled={!hasPlayersOnCourt || isGameOver}
                  className="h-8 w-8 rounded-lg text-sm font-bold shadow-sm shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={isGameOver ? "Game point reached (add disabled)" : "Add 1 point"}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Win Buttons if game not yet over */}
          {hasPlayersOnCourt && !isGameOver && (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleQuickWin("A")}
                className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-500/30 rounded-lg py-1 px-2 transition-colors flex items-center justify-center gap-1 shadow-2xs"
                title="Quickly set Team 1 as the winner with 11 points"
              >
                ⚡ Team 1 Wins (11)
              </button>
              <button
                type="button"
                onClick={() => handleQuickWin("B")}
                className="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950/70 border border-sky-500/30 rounded-lg py-1 px-2 transition-colors flex items-center justify-center gap-1 shadow-2xs"
                title="Quickly set Team 2 as the winner with 11 points"
              >
                ⚡ Team 2 Wins (11)
              </button>
            </div>
          )}

          {/* Outcome Status / Highlight */}
          {isGameOver && hasPlayersOnCourt && (
            <div className="text-center font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 py-1.5 px-2 rounded-lg border border-emerald-500/40 shadow-xs animate-in fade-in">
              🏆 Game Point Reached: {winner} Wins ({scoreA} - {scoreB})
            </div>
          )}
        </div>

        {/* Complete & Submit Match Score Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="volt"
            size="default"
            onClick={handleSubmitScore}
            disabled={isPending || !hasPlayersOnCourt || !isGameOver}
            className={`w-full font-bold font-mono text-xs h-10 shadow-sm transition-all ${
              !hasPlayersOnCourt || !isGameOver
                ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                : "shadow-emerald-500/20 bg-[#d4e938] text-slate-950 hover:bg-[#c2d730] ring-2 ring-[#d4e938]/40"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 mr-1.5" />
            {isPending
              ? "Submitting Score..."
              : !hasPlayersOnCourt
              ? "No Players on Court (Disabled)"
              : !isGameOver
              ? "Match In Progress (Play to 11, Win by 2)"
              : `Complete & Submit Match (${winner} Wins)`}
          </Button>

          {!hasPlayersOnCourt ? (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono mt-1">
              ⚠️ Call players from queue to start match & record score
            </p>
          ) : !isGameOver ? (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono mt-1">
              Record points until 11 (win by 2) or use <strong>⚡ Quick Win</strong> buttons
            </p>
          ) : (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 text-center font-mono mt-1 font-semibold">
              ✓ Ready to submit! This updates player DUPR and pulls the next queue pod.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface UpNextQueuePanelProps {
  queue: QueueEntryWithPlayer[];
  courts: ActiveCourtView[];
  sessionId?: string;
}

function UpNextQueuePanel({ queue, courts, sessionId }: UpNextQueuePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const waitingQueue = queue.filter((q) => q.status === "waiting");
  const onDeckPlayers = waitingQueue.slice(0, 4);
  const remainingQueue = waitingQueue.slice(4);

  const availableCourts = courts.filter((c) => c.status === "available");

  function handleQuickAssignCourt(courtId: string) {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await callNextUp(sessionId, courtId, 4);
      if (res?.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-md backdrop-blur-md flex flex-col h-fit sticky top-6">
      <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Up Next to Play
              </CardTitle>
              <Badge variant="volt" className="text-[10px] py-0 px-1.5 font-mono font-bold">
                {waitingQueue.length} WAITING
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Paddle queue order & rotation lineup
            </p>
          </div>

          <Link href="/queue">
            <Button variant="outline" size="sm" className="h-7 text-[11px] font-mono px-2">
              Manage Queue <ExternalLink className="h-2.5 w-2.5 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* On Deck Section (Next 4) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1">
              <Zap className="h-3 w-3" />
              ON DECK (Next 4 for Open Court)
            </span>
            <span className="text-[10px] text-slate-400">
              Est. wait ~{waitingQueue.length > 0 ? `${waitingQueue.length * 3}m` : "0m"}
            </span>
          </div>

          {onDeckPlayers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center space-y-2 font-mono">
              <Users className="h-6 w-6 text-slate-400 mx-auto opacity-50" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No players currently waiting in queue.
              </p>
              <Link
                href="/queue"
                className="inline-block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                + Check In Players on Queue Board →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {onDeckPlayers.map((entry, idx) => {
                const p = entry.player;
                const minsAgo = Math.max(
                  0,
                  Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000)
                );
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 font-mono shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-slate-950 font-bold text-[11px] shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {p?.full_name || p?.display_name || "Player"}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {entry.group_id ? "Doubles Pair" : "Singles"} • ~{minsAgo}m ago
                        </div>
                      </div>
                    </div>

                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono shrink-0">
                      DUPR {p?.skill_rating ? Number(p.skill_rating).toFixed(2) : "3.00"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Assign to Available Court if any */}
        {availableCourts.length > 0 && onDeckPlayers.length > 0 && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/30 p-3 space-y-2">
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Quick Dispatch Next 4 to Court:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableCourts.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="volt"
                  size="sm"
                  onClick={() => handleQuickAssignCourt(c.id)}
                  disabled={isPending}
                  className="font-mono text-[11px] h-7 px-2.5 shadow-2xs font-bold"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {c.name.replace(/\s*\(Rented Court\)/i, "")}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Later in Queue */}
        {remainingQueue.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
              Following in Queue ({remainingQueue.length}):
            </span>

            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {remainingQueue.map((entry, idx) => {
                const p = entry.player;
                const minsAgo = Math.max(
                  0,
                  Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000)
                );
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/50 font-mono text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-slate-400 font-bold text-[10px]">
                        #{idx + 5}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {p?.full_name || p?.display_name || "Player"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 shrink-0">
                      <span>~{minsAgo}m</span>
                      <span className="font-bold text-slate-600 dark:text-slate-400">
                        {p?.skill_rating ? Number(p.skill_rating).toFixed(2) : "3.00"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ScoreRecorder({
  courts = [],
  sessionId,
  initialQueue = [],
}: ScoreRecorderProps) {
  const waitingCount = initialQueue.filter((q) => q.status === "waiting").length;

  if (courts.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-12 text-center space-y-4 font-mono">
        <Activity className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            No Active Courts Found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Courts are automatically provisioned when an administrator starts or schedules an Open-Play session.
          </p>
        </div>
        <Link href="/admin/courts">
          <Button variant="volt" size="sm" className="font-mono text-xs font-bold">
            Configure Courts
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left / Main Section: Court Containers (Separate Container per Court) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {courts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              sessionId={sessionId}
              waitingQueueCount={waitingCount}
            />
          ))}
        </div>
      </div>

      {/* Right / Sidebar Section: "Up Next" Queue line (Pickleq Style) */}
      <div className="lg:col-span-1">
        <UpNextQueuePanel
          queue={initialQueue}
          courts={courts}
          sessionId={sessionId}
        />
      </div>
    </div>
  );
}
