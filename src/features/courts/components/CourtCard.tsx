"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Plus,
  Minus,
  CheckCircle2,
  Zap,
  Activity,
  RotateCcw,
  Clock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { finalizeMatch } from "@/features/matches/api/matchActions";
import { callNextUp } from "@/features/queue/api/queueActions";
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

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400 shadow-2xs">
      <Clock className="h-3 w-3 text-rose-500 animate-pulse" />
      <span>⏱️ {elapsed}</span>
    </div>
  );
}

export interface CourtCardProps {
  court: ActiveCourtView;
  sessionId?: string;
  waitingQueueCount?: number;
  userRole?: string;
  isAdmin?: boolean;
  readOnly?: boolean;
  targetPoints?: number;
}

export function CourtCard({
  court,
  sessionId,
  waitingQueueCount = 0,
  userRole = "player",
  isAdmin,
  readOnly = false,
  targetPoints = 11,
}: CourtCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isAdministrator = !readOnly && (isAdmin ?? (userRole === "admin"));

  // Dynamic game finish target: 6 points (speed play) or 11 points (standard)
  const [courtTargetPoints, setCourtTargetPoints] = useState<number>(targetPoints || 11);

  useEffect(() => {
    if (targetPoints) {
      setCourtTargetPoints(targetPoints);
    }
  }, [targetPoints]);

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
    const target = courtTargetPoints;
    const losingScore = target === 6 ? 4 : Math.max(0, target - 2);
    if (team === "A") {
      setScoreA(target);
      setScoreB((prev) => (prev >= target ? losingScore : prev));
    } else {
      setScoreB(target);
      setScoreA((prev) => (prev >= target ? losingScore : prev));
    }
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
        setSuccessMessage("Next pod rotated from queue onto this court!");
        router.refresh();
      }
    });
  }

  // Victory Condition: Respects dynamic targetPoints (6 pts win by 1, or 11 pts win by 2)
  const winMargin = courtTargetPoints === 6 ? 1 : 2;
  const isGameOver =
    (scoreA >= courtTargetPoints && scoreA - scoreB >= winMargin) ||
    (scoreB >= courtTargetPoints && scoreB - scoreA >= winMargin);
  const winner =
    scoreA >= courtTargetPoints && scoreA - scoreB >= winMargin
      ? "Team 1"
      : scoreB >= courtTargetPoints && scoreB - scoreA >= winMargin
      ? "Team 2"
      : null;

  function handleSubmitScore() {
    if (!isAdministrator || isPending) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!hasPlayersOnCourt || !activeMatch) {
      setErrorMessage("Cannot submit score: No players or active match on this court.");
      return;
    }

    if (!isGameOver) {
      setErrorMessage(
        "Cannot submit match: Score is not finished yet. Pickleball games must reach at least 11 points and win by 2."
      );
      return;
    }

    startTransition(async () => {
      const res = await finalizeMatch(activeMatch.id, scoreA, scoreB);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(
          `Match completed! Final Score: ${scoreA} - ${scoreB}. Court is now ready for next rotation.`
        );
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
    <div className="group/court relative rounded-[1.75rem] p-1.5 border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-900/60 backdrop-blur-md shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
      {/* Inner Core Container */}
      <div className="rounded-[1.4rem] bg-white dark:bg-[#0c121d] border border-slate-100 dark:border-slate-800/60 overflow-hidden flex flex-col justify-between flex-1">
        {/* Court Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {cleanCourtName}
                </span>
                {isExistingLiveMatch ? (
                  <Badge
                    variant="default"
                    className="text-[10px] py-0.5 px-2 font-mono font-bold bg-rose-600 hover:bg-rose-600 text-white shadow-2xs flex items-center gap-1"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-200 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                    </span>
                    IN PLAY
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[10px] py-0.5 px-2 font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center gap-1"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                    READY / OPEN
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {court.surface_type || "Pro Acrylic Court"} • Play to 11 (Win by 2)
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isExistingLiveMatch && (
                <CourtDurationClock startedAt={activeMatch?.started_at} />
              )}
              {isAdministrator && (
                <Link
                  href={`/courts/${court.id}/monitor`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-2xs cursor-pointer active:scale-95"
                  title={`Open full-screen referee umpire monitor for ${cleanCourtName}`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Umpire Mode</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Court Body */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
          {/* Status Messages */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="flex-1">{successMessage}</span>
            </div>
          )}

          {/* Court State: Match in Progress */}
          {isExistingLiveMatch && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                <span className="uppercase flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
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
                        className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1.5 rounded-lg border border-emerald-500/20 text-slate-900 dark:text-slate-100 shadow-2xs"
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
                        className="flex items-center justify-between bg-white dark:bg-slate-900 px-2 py-1.5 rounded-lg border border-sky-500/20 text-slate-900 dark:text-slate-100 shadow-2xs"
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
          )}

          {/* Score Board & Steppers */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                  Live Score:
                </span>
                {isAdministrator && (
                  <div className="flex items-center gap-1 font-mono text-[9px]">
                    <button
                      type="button"
                      onClick={() => setCourtTargetPoints(6)}
                      className={`px-1.5 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                        courtTargetPoints === 6
                          ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      ⚡ 6 Pts
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourtTargetPoints(11)}
                      className={`px-1.5 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                        courtTargetPoints === 11
                          ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-2xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      🏆 11 Pts
                    </button>
                  </div>
                )}
              </div>
              {isAdministrator && (
                <button
                  type="button"
                  onClick={handleResetScore}
                  disabled={!hasPlayersOnCourt}
                  className="text-[10px] font-mono text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-2.5 w-2.5" /> Reset 0-0
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Team 1 Score */}
              <div
                className={`rounded-2xl border-2 p-3 text-center space-y-1.5 shadow-2xs transition-all ${
                  winner === "Team 1"
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30"
                    : "border-emerald-500/30 bg-slate-50/70 dark:bg-slate-950/70"
                }`}
              >
                <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  TEAM 1 {winner === "Team 1" && "🏆 WINNER"}
                </span>
                <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-600 dark:text-emerald-400 py-0.5">
                  {scoreA}
                </div>
                {isAdministrator && (
                  <div className="flex items-center justify-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => decrementScore("A")}
                      disabled={!hasPlayersOnCourt || scoreA === 0}
                      className="h-8 w-8 rounded-lg text-sm font-bold disabled:opacity-40 cursor-pointer active:scale-95 transition-transform"
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
                      className="h-8 w-8 rounded-lg text-sm font-bold shadow-sm shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 transition-transform"
                      title={isGameOver ? "Game point reached (add disabled)" : "Add 1 point"}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Team 2 Score */}
              <div
                className={`rounded-2xl border-2 p-3 text-center space-y-1.5 shadow-2xs transition-all ${
                  winner === "Team 2"
                    ? "border-sky-500 bg-sky-50/80 dark:bg-sky-950/60 ring-2 ring-sky-500/30"
                    : "border-sky-500/30 bg-slate-50/70 dark:bg-slate-950/70"
                }`}
              >
                <span className="text-[10px] font-bold font-mono text-sky-600 dark:text-sky-400 uppercase tracking-wider block">
                  TEAM 2 {winner === "Team 2" && "🏆 WINNER"}
                </span>
                <div className="text-4xl sm:text-5xl font-black font-mono text-sky-600 dark:text-sky-400 py-0.5">
                  {scoreB}
                </div>
                {isAdministrator && (
                  <div className="flex items-center justify-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => decrementScore("B")}
                      disabled={!hasPlayersOnCourt || scoreB === 0}
                      className="h-8 w-8 rounded-lg text-sm font-bold disabled:opacity-40 cursor-pointer active:scale-95 transition-transform"
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
                      className="h-8 w-8 rounded-lg text-sm font-bold shadow-sm shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 transition-transform"
                      title={isGameOver ? "Game point reached (add disabled)" : "Add 1 point"}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Win Buttons if game not yet over (Admin only) */}
            {isAdministrator && hasPlayersOnCourt && !isGameOver && (
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleQuickWin("A")}
                  className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-500/30 rounded-xl py-1.5 px-2 transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                  title={`Quickly set Team 1 as the winner with ${courtTargetPoints} points`}
                >
                  ⚡ Team 1 Wins ({courtTargetPoints})
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickWin("B")}
                  className="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-950/70 border border-sky-500/30 rounded-xl py-1.5 px-2 transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                  title={`Quickly set Team 2 as the winner with ${courtTargetPoints} points`}
                >
                  ⚡ Team 2 Wins ({courtTargetPoints})
                </button>
              </div>
            )}

            {/* Outcome Status Banner */}
            {isGameOver && hasPlayersOnCourt && (
              <div className="text-center font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50/90 dark:bg-emerald-950/70 py-2 px-2.5 rounded-xl border border-emerald-500/40 shadow-xs animate-in fade-in">
                🏆 Game Point Reached: {winner} Wins ({scoreA} - {scoreB})
              </div>
            )}
          </div>

          {/* Action Button Section: Admin Submit vs Spectator Status */}
          <div className="pt-2">
            {isAdministrator ? (
              <>
                <Button
                  type="button"
                  variant="volt"
                  size="default"
                  onClick={handleSubmitScore}
                  disabled={isPending || !hasPlayersOnCourt || !isGameOver}
                  className={`w-full font-bold font-mono text-xs h-11 rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                    !hasPlayersOnCourt || !isGameOver
                      ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                      : "shadow-emerald-500/20 bg-[#d4e938] text-slate-950 hover:bg-[#c2d730] ring-2 ring-[#d4e938]/40 cursor-pointer"
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
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono mt-1.5">
                    ⚠️ Call players from queue to start match & record score
                  </p>
                ) : !isGameOver ? (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono mt-1.5">
                    Record points until 11 (win by 2) or use <strong>⚡ Quick Win</strong> buttons
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 text-center font-mono mt-1.5 font-semibold">
                    ✓ Ready to submit! This updates player DUPR and pulls the next queue pod.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 p-3 text-center font-mono space-y-0.5">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
                  {isExistingLiveMatch ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      {isGameOver ? `Game Complete • ${winner} Won` : "Match In Progress"}
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                      Court Available • Ready for Next Rotation
                    </>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {isExistingLiveMatch
                    ? isGameOver
                      ? "Official referee is finalizing match score & player ratings."
                      : "Scores update live in real-time as staff referees award points."
                    : "Next 4 players from the paddle rack will be rotated onto this court."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
