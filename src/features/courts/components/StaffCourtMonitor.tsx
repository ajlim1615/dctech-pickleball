"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Play,
  Plus,
  Minus,
  RotateCcw,
  Timer,
  Trophy,
  ArrowLeft,
  Volume2,
  BellRing,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourtStatusIndicator } from "@/components/layout/CourtStatusIndicator";
import { finalizeMatch, updateMatchScore, createMatch } from "@/features/matches/api/matchActions";
import { callNextUp } from "@/features/queue/api/queueActions";
import type { ActiveCourtView, Profile, CourtStatus, MatchFormat } from "@/types";

interface StaffCourtMonitorProps {
  courtId: string;
  courtName?: string;
  court?: ActiveCourtView | null;
  employees?: Profile[];
  sessionId?: string;
}

export function StaffCourtMonitor({
  courtId,
  courtName = `Court`,
  court,
  employees = [],
  sessionId,
}: StaffCourtMonitorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentMatch = court?.current_match;
  const isCurrentlyInPlay = Boolean(currentMatch && currentMatch.status === "in_progress");

  // Player Names
  const initialTeamA = currentMatch?.players
    ?.filter((p) => p.team === "team_a")
    ?.map((p: any) => p.profile?.full_name || p.profile?.display_name || p.player?.full_name || p.player?.display_name || "Player")
    ?.join(" & ") || "";

  const initialTeamB = currentMatch?.players
    ?.filter((p) => p.team === "team_b")
    ?.map((p: any) => p.profile?.full_name || p.profile?.display_name || p.player?.full_name || p.player?.display_name || "Player")
    ?.join(" & ") || "";

  const [teamAName, setTeamAName] = useState(initialTeamA || "Team 1");
  const [teamBName, setTeamBName] = useState(initialTeamB || "Team 2");

  // New Match Setup State (if court is waiting)
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [selectedP1, setSelectedP1] = useState<string>("");
  const [selectedP2, setSelectedP2] = useState<string>("");
  const [selectedP3, setSelectedP3] = useState<string>("");
  const [selectedP4, setSelectedP4] = useState<string>("");

  // Live Score State
  const [scoreA, setScoreA] = useState<number>(currentMatch?.team_a_score || 0);
  const [scoreB, setScoreB] = useState<number>(currentMatch?.team_b_score || 0);
  const [servingTeam, setServingTeam] = useState<"A" | "B">("A");
  const [serverNumber, setServerNumber] = useState<1 | 2>(2);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number | null>(null);
  const [completed, setCompleted] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Active match ID
  const [activeMatchId, setActiveMatchId] = useState<string | null>(currentMatch?.id || null);

  // Timer countdown for 60s timeout
  useEffect(() => {
    if (timeoutSeconds === null || timeoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimeoutSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeoutSeconds]);

  // Standard Pickleball Call String (e.g. "0 - 0 - 2")
  const servingScore = servingTeam === "A" ? scoreA : scoreB;
  const receivingScore = servingTeam === "A" ? scoreB : scoreA;
  const pickleballCall = `${servingScore} - ${receivingScore} - ${serverNumber}`;

  // Standard Pickleball Victory Condition: 11 points and win by 2
  const isGameWon = (scoreA >= 11 || scoreB >= 11) && Math.abs(scoreA - scoreB) >= 2;
  const winningTeam = scoreA >= 11 && scoreA - scoreB >= 2 ? "A" : scoreB >= 11 && scoreB - scoreA >= 2 ? "B" : null;
  const winningTeamName = winningTeam === "A" ? teamAName : winningTeam === "B" ? teamBName : null;

  const [showManualSetup, setShowManualSetup] = useState(false);

  // Notice helper
  function showNotice(msg: string) {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 3000);
  }

  function handlePointForTeam(team: "A" | "B") {
    if (servingTeam !== team) {
      setServingTeam(team);
      setServerNumber(1);
    }

    if (team === "A") {
      const next = scoreA + 1;
      setScoreA(next);
      if (activeMatchId) updateMatchScore(activeMatchId, next, scoreB);
      if (next >= 11 && next - scoreB >= 2) {
        showNotice(`🎉 Match Won by ${teamAName}! (${next} – ${scoreB})`);
      }
    } else {
      const next = scoreB + 1;
      setScoreB(next);
      if (activeMatchId) updateMatchScore(activeMatchId, scoreA, next);
      if (next >= 11 && next - scoreA >= 2) {
        showNotice(`🎉 Match Won by ${teamBName}! (${next} – ${scoreA})`);
      }
    }

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(40);
      } catch {}
    }
  }

  function handleToggleServerNumber() {
    setServerNumber((prev) => (prev === 1 ? 2 : 1));
  }

  function handleSetServingTeam(team: "A" | "B") {
    setServingTeam(team);
    setServerNumber(1);
  }

  function handleSideOut() {
    if (serverNumber === 1) {
      setServerNumber(2);
      showNotice(`Rotated to Server #2 for Team ${servingTeam}`);
    } else {
      const nextTeam = servingTeam === "A" ? "B" : "A";
      setServerNumber(1);
      setServingTeam(nextTeam);
      showNotice(`Side Out! Turnover to Team ${nextTeam} (Server #1)`);
    }

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([50, 40, 50]);
      } catch {}
    }
  }

  async function handleStartManualMatch() {
    if (!sessionId) {
      alert("No active session scheduled. Please schedule a session in Admin panel first.");
      return;
    }

    const teamAPlayers = format === "doubles" ? [selectedP1, selectedP2].filter(Boolean) : [selectedP1].filter(Boolean);
    const teamBPlayers = format === "doubles" ? [selectedP3, selectedP4].filter(Boolean) : [selectedP3].filter(Boolean);

    const required = format === "doubles" ? 2 : 1;
    if (teamAPlayers.length < required || teamBPlayers.length < required) {
      alert(`Please select all players for ${format === "doubles" ? "Doubles (2 per team)" : "Singles (1 per team)"}.`);
      return;
    }

    startTransition(async () => {
      const res = await createMatch({
        sessionId,
        courtId,
        format,
        teamAPlayerIds: teamAPlayers,
        teamBPlayerIds: teamBPlayers,
      });

      if (res?.error || !res.matchId) {
        alert(res?.error || "Failed to start match");
      } else {
        setActiveMatchId(res.matchId);
        const nameA = employees.filter((e) => teamAPlayers.includes(e.id)).map((e) => e.full_name || e.display_name).join(" & ");
        const nameB = employees.filter((e) => teamBPlayers.includes(e.id)).map((e) => e.full_name || e.display_name).join(" & ");
        setTeamAName(nameA || "Team 1");
        setTeamBName(nameB || "Team 2");
        setScoreA(0);
        setScoreB(0);
        setServingTeam("A");
        setServerNumber(2);
        showNotice("Match started live on court!");
        router.refresh();
      }
    });
  }

  async function handleCallNextFromQueue() {
    if (!sessionId) {
      alert("No active session found.");
      return;
    }

    startTransition(async () => {
      const res = await callNextUp(sessionId, courtId, 4);
      if (res?.error) {
        showNotice(`Queue empty or error: ${res.error}`);
      } else {
        showNotice(`Next players called from the queue to ${courtName}!`);
        setScoreA(0);
        setScoreB(0);
        setServerNumber(2);
        setServingTeam("A");
        router.refresh();
      }
    });
  }

  async function handleFinalizeGame() {
    if (!confirm(`Finalize and record game score for ${courtName} as ${scoreA} – ${scoreB}?`)) {
      return;
    }

    startTransition(async () => {
      if (activeMatchId) {
        await finalizeMatch(activeMatchId, scoreA, scoreB);
      }
      setCompleted(true);
      router.refresh();
    });
  }

  if (completed) {
    const winner = scoreA > scoreB ? teamAName : scoreB > scoreA ? teamBName : "TIE";
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-emerald-500/40 bg-white dark:bg-slate-900/90 text-center p-8 space-y-5 shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
            <Trophy className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Match Completed & Recorded!
            </h2>
            <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              Final Score: {scoreA} – {scoreB} ({winner} Victory)
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Player skill ratings and leaderboard standings have been updated.
            </p>
          </div>

          <div className="pt-4 flex justify-center gap-3 font-mono">
            <Button
              variant="volt"
              onClick={() => router.push("/")}
              className="font-bold text-xs"
            >
              Back to Live Courts
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCompleted(false);
                setActiveMatchId(null);
                setScoreA(0);
                setScoreB(0);
                router.refresh();
              }}
              className="text-xs"
            >
              Umpire Next Match
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-mono transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Live Courts
        </a>

        <div className="flex items-center gap-2">
          <Badge variant="volt" className="text-xs font-mono">
            STAFF UMPIRE MODE
          </Badge>
          <CourtStatusIndicator status={activeMatchId ? "occupied" : (court?.status || "available")} />
        </div>
      </div>

      {/* Notice Pill */}
      {statusNotice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Header Banner */}
      <Card className="border-emerald-500/40 bg-white/90 dark:bg-slate-900/90 shadow-md backdrop-blur-md">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 font-mono text-base font-bold text-slate-950 shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">{courtName} Umpire Monitor</h1>
                <Badge variant="default" className="text-[10px] font-mono">
                  ACTIVE
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Assigned Referee: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{court?.assigned_staff?.full_name || "Sports Staff"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {timeoutSeconds !== null ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 animate-pulse">
                <Timer className="h-4 w-4" />
                TIMEOUT: {timeoutSeconds}s
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTimeoutSeconds(60)}
                className="text-xs font-mono"
              >
                <Timer className="h-3.5 w-3.5 mr-1" />
                60s Timeout
              </Button>
            )}

            {!activeMatchId && !isCurrentlyInPlay && (
              <Button
                variant="volt"
                size="sm"
                onClick={handleCallNextFromQueue}
                disabled={isPending}
                className="text-xs font-mono font-bold"
              >
                <BellRing className="h-3.5 w-3.5 mr-1" />
                Call Queue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* If No Live Match is Active: Auto-Call from Queue First */}
      {!activeMatchId && !isCurrentlyInPlay ? (
        <div className="space-y-4">
          <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-6 space-y-4 shadow-sm text-center">
            <div className="space-y-1">
              <div className="mx-auto inline-flex items-center justify-center p-2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-1">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {courtName} is Ready for Next Rotation
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Click below to automatically call the next 4 players from the active paddle queue, balance teams by DUPR rating, and start live referee scoring immediately.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                type="button"
                variant="volt"
                size="lg"
                onClick={handleCallNextFromQueue}
                disabled={isPending}
                className="w-full sm:w-auto font-bold text-xs h-11 px-6 shadow-md shadow-emerald-500/10 font-mono"
              >
                <Zap className="h-4 w-4 mr-2" />
                {isPending ? "Assigning Queued Players..." : "⚡ Auto-Call Next 4 Players from Queue"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setShowManualSetup(!showManualSetup)}
                className="w-full sm:w-auto text-xs font-mono"
              >
                {showManualSetup ? "Hide Manual Setup" : "Manual Player Override"}
              </Button>
            </div>
          </Card>

          {/* Optional Manual Setup for Custom Friendly/Exhibition Matches */}
          {showManualSetup && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4 shadow-sm">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Manual Custom Match Setup
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pick specific players manually from the directory.
                </p>
              </div>

              {/* Format Toggle */}
              <div className="flex justify-center">
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 font-mono text-xs shadow-inner">
                  <button
                    type="button"
                    onClick={() => setFormat("doubles")}
                    className={`px-4 py-1.5 rounded-md font-bold transition-all ${
                      format === "doubles"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Doubles (2v2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat("singles")}
                    className={`px-4 py-1.5 rounded-md font-bold transition-all ${
                      format === "singles"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Singles (1v1)
                  </button>
                </div>
              </div>

              {/* Player Selection Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-xl border border-emerald-500/30 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    TEAM 1 PLAYERS
                  </span>
                  <select
                    value={selectedP1}
                    onChange={(e) => setSelectedP1(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                  >
                    <option value="">-- Select Player 1 --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name || e.display_name} ({e.skill_rating.toFixed(2)})
                      </option>
                    ))}
                  </select>

                  {format === "doubles" && (
                    <select
                      value={selectedP2}
                      onChange={(e) => setSelectedP2(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                    >
                      <option value="">-- Select Player 2 --</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name || e.display_name} ({e.skill_rating.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="rounded-xl border border-sky-500/30 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
                  <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase">
                    TEAM 2 PLAYERS
                  </span>
                  <select
                    value={selectedP3}
                    onChange={(e) => setSelectedP3(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                  >
                    <option value="">-- Select Player 1 --</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name || e.display_name} ({e.skill_rating.toFixed(2)})
                      </option>
                    ))}
                  </select>

                  {format === "doubles" && (
                    <select
                      value={selectedP4}
                      onChange={(e) => setSelectedP4(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                    >
                      <option value="">-- Select Player 2 --</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name || e.display_name} ({e.skill_rating.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="volt"
                size="lg"
                onClick={handleStartManualMatch}
                disabled={isPending}
                className="w-full font-bold text-xs h-11 shadow-md shadow-emerald-500/10"
              >
                <Play className="h-4 w-4 mr-2" />
                {isPending ? "Starting Match..." : "Start Custom Match on this Court"}
              </Button>
            </Card>
          )}
        </div>
      ) : (
        /* Live Scoring Arena */
        <>
          {/* Victory Banner if Match Point / Win Threshold Reached */}
          {isGameWon && (
            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 p-5 text-center space-y-2 font-mono shadow-lg animate-pulse">
              <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300">
                <Trophy className="h-6 w-6 text-amber-500 animate-bounce" />
                GAME WON BY {winningTeamName?.toUpperCase()} ({Math.max(scoreA, scoreB)} – {Math.min(scoreA, scoreB)})!
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-sans">
                Official winning threshold reached (11 points, win by 2). Tap &quot;Complete Game & Record Score&quot; below to record the match stats and free the court for the next queue pod.
              </p>
            </div>
          )}

          {/* Official Pickleball Announcer Box */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 text-center space-y-2 font-mono shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Volume2 className="h-4 w-4 text-emerald-600 dark:text-[#d4e938]" />
              OFFICIAL PICKLEBALL CALL
            </span>
            <div className="text-5xl sm:text-6xl font-black text-emerald-700 dark:text-[#d4e938] tracking-tight">
              {pickleballCall}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Serving: <span className="text-emerald-600 dark:text-emerald-400 font-bold">Team {servingTeam}</span> • Server #{serverNumber}
            </div>
          </div>

          {/* Interactive Steppers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Team 1 Box */}
            <Card
              className={`border-2 p-5 text-center space-y-4 shadow-sm ${
                servingTeam === "A"
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  TEAM 1 {servingTeam === "A" ? "(SERVING)" : ""}
                </span>
                {servingTeam === "A" ? (
                  <button
                    type="button"
                    onClick={handleToggleServerNumber}
                    title="Click to toggle Server 1 vs 2"
                    className="cursor-pointer transition-transform hover:scale-105"
                  >
                    <Badge variant="default" className="text-[10px] font-mono">
                      SERVER #{serverNumber} ⇄
                    </Badge>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetServingTeam("A")}
                    className="text-[10px] font-mono text-slate-400 hover:text-emerald-600 hover:underline"
                  >
                    Set Serving
                  </button>
                )}
              </div>

              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {teamAName}
              </div>

              <div className="text-7xl font-black font-mono text-emerald-600 dark:text-emerald-400 py-1">
                {scoreA}
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setScoreA((prev) => Math.max(0, prev - 1))}
                  className="h-12 w-12 rounded-xl text-lg font-bold"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  onClick={() => handlePointForTeam("A")}
                  className="h-12 w-12 rounded-xl text-lg font-bold shadow-md shadow-emerald-500/20"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </Card>

            {/* Team 2 Box */}
            <Card
              className={`border-2 p-5 text-center space-y-4 shadow-sm ${
                servingTeam === "B"
                  ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500/30"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase">
                  TEAM 2 {servingTeam === "B" ? "(SERVING)" : ""}
                </span>
                {servingTeam === "B" ? (
                  <button
                    type="button"
                    onClick={handleToggleServerNumber}
                    title="Click to toggle Server 1 vs 2"
                    className="cursor-pointer transition-transform hover:scale-105"
                  >
                    <Badge variant="sky" className="text-[10px] font-mono">
                      SERVER #{serverNumber} ⇄
                    </Badge>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetServingTeam("B")}
                    className="text-[10px] font-mono text-slate-400 hover:text-sky-600 hover:underline"
                  >
                    Set Serving
                  </button>
                )}
              </div>

              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {teamBName}
              </div>

              <div className="text-7xl font-black font-mono text-sky-600 dark:text-sky-400 py-1">
                {scoreB}
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setScoreB((prev) => Math.max(0, prev - 1))}
                  className="h-12 w-12 rounded-xl text-lg font-bold"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="volt"
                  size="icon"
                  onClick={() => handlePointForTeam("B")}
                  className="h-12 w-12 rounded-xl text-lg font-bold shadow-md shadow-emerald-500/20"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Action Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleSideOut}
              className="font-mono text-xs font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 h-12"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Side Out / Fault (Rotate Server)
            </Button>

            <Button
              type="button"
              variant="volt"
              size="lg"
              onClick={handleFinalizeGame}
              disabled={isPending}
              className={`font-mono text-xs font-bold h-12 transition-all ${
                isGameWon
                  ? "bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/40 font-black shadow-lg"
                  : "shadow-md shadow-emerald-500/10"
              }`}
            >
              <Trophy className="h-4 w-4 mr-2" />
              {isPending
                ? "Finalizing Game..."
                : isGameWon
                ? `🏆 Finalize Victory for ${winningTeamName} (${scoreA}–${scoreB})`
                : "Complete Game & Record Score"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
