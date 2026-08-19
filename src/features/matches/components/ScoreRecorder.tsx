"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Plus,
  Minus,
  Check,
  Zap,
  Activity,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createMatch, finalizeMatch } from "../api/matchActions";
import { callNextUp } from "@/features/queue/api/queueActions";
import type { ActiveCourtView, Profile, MatchFormat } from "@/types";

interface ScoreRecorderProps {
  courts?: ActiveCourtView[];
  players?: Profile[];
  sessionId?: string;
}

export function ScoreRecorder({
  courts = [],
  players = [],
  sessionId,
}: ScoreRecorderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Court selection
  const [selectedCourtId, setSelectedCourtId] = useState<string>(
    courts[0]?.id || ""
  );

  // Selected court object
  const selectedCourt = courts.find((c) => c.id === selectedCourtId) || courts[0];
  const activeMatch = selectedCourt?.current_match;

  // Game config
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [teamA1, setTeamA1] = useState<string>("");
  const [teamA2, setTeamA2] = useState<string>("");
  const [teamB1, setTeamB1] = useState<string>("");
  const [teamB2, setTeamB2] = useState<string>("");

  // Stepper scores
  const [scoreA, setScoreA] = useState<number>(activeMatch?.team_a_score || 0);
  const [scoreB, setScoreB] = useState<number>(activeMatch?.team_b_score || 0);
  const [completed, setCompleted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Auto-fill players if court has an active match
  const isExistingLiveMatch = Boolean(activeMatch && activeMatch.status === "in_progress");

  function handleSelectCourt(court: ActiveCourtView) {
    setSelectedCourtId(court.id);
    setErrorMessage(null);
    if (court.current_match) {
      setScoreA(court.current_match.team_a_score || 0);
      setScoreB(court.current_match.team_b_score || 0);
    } else {
      setScoreA(0);
      setScoreB(0);
      setTeamA1("");
      setTeamA2("");
      setTeamB1("");
      setTeamB2("");
    }
  }

  function incrementScore(team: "A" | "B") {
    if (team === "A") setScoreA((prev) => prev + 1);
    else setScoreB((prev) => prev + 1);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(30);
      } catch {}
    }
  }

  function decrementScore(team: "A" | "B") {
    if (team === "A") setScoreA((prev) => Math.max(0, prev - 1));
    else setScoreB((prev) => Math.max(0, prev - 1));
  }

  function handleReset() {
    setScoreA(0);
    setScoreB(0);
  }

  async function handleAutoCallQueue() {
    if (!sessionId) {
      setErrorMessage("No active session found. Please check sessions first.");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      const res = await callNextUp(sessionId, selectedCourtId, 4);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        router.refresh();
      }
    });
  }

  async function handleSubmit() {
    setErrorMessage(null);

    // If court already has a live match, just finalize it
    if (isExistingLiveMatch && activeMatch) {
      startTransition(async () => {
        const res = await finalizeMatch(activeMatch.id, scoreA, scoreB);
        if (res?.error) {
          setErrorMessage(res.error);
        } else {
          setCompleted(true);
        }
      });
      return;
    }

    // New match validation
    if (!sessionId) {
      setErrorMessage("No active session scheduled. Please check sessions first.");
      return;
    }

    const teamAPlayers = format === "doubles" ? [teamA1, teamA2].filter(Boolean) : [teamA1].filter(Boolean);
    const teamBPlayers = format === "doubles" ? [teamB1, teamB2].filter(Boolean) : [teamB1].filter(Boolean);

    const required = format === "doubles" ? 2 : 1;
    if (teamAPlayers.length < required || teamBPlayers.length < required) {
      setErrorMessage(`Please select all players for ${format === "doubles" ? "Doubles (2 per team)" : "Singles (1 per team)"}.`);
      return;
    }

    startTransition(async () => {
      // 1. Create match
      const createRes = await createMatch({
        sessionId,
        courtId: selectedCourtId,
        format,
        teamAPlayerIds: teamAPlayers,
        teamBPlayerIds: teamBPlayers,
      });

      if (createRes?.error || !createRes?.matchId) {
        setErrorMessage(createRes?.error || "Failed to create match");
        return;
      }

      // 2. Finalize match with entered scores
      const finRes = await finalizeMatch(createRes.matchId, scoreA, scoreB);
      if (finRes?.error) {
        setErrorMessage(finRes.error);
      } else {
        setCompleted(true);
      }
    });
  }

  if (completed) {
    const winnerName = scoreA > scoreB ? "TEAM 1" : scoreB > scoreA ? "TEAM 2" : "TIE";
    return (
      <Card className="w-full max-w-xl mx-auto border-emerald-500/40 bg-white dark:bg-slate-900/90 text-center p-8 space-y-5 backdrop-blur-md shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
          <Trophy className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Match Finalized & Recorded!
          </h2>
          <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">
            Final Score: {scoreA} – {scoreB} ({winnerName} VICTORY)
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Player DUPR ratings and leaderboard standings have been updated.
          </p>
        </div>

        <div className="pt-3 flex justify-center gap-3 font-mono">
          <Button
            variant="volt"
            onClick={() => router.push("/")}
            className="font-bold text-xs"
          >
            Back to Live Courts
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/rankings")}
            className="text-xs"
          >
            View Leaderboard
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xl backdrop-blur-md">
      <CardHeader className="text-center pb-4 border-b border-slate-200 dark:border-slate-800/80 space-y-1">
        <div className="flex items-center justify-center gap-2">
          <Badge variant="volt" className="text-xs">
            LIVE COURT SCORE RECORDER
          </Badge>
          {isExistingLiveMatch && (
            <Badge variant="default" className="text-xs">
              ACTIVE MATCH IN PROGRESS
            </Badge>
          )}
        </div>
        <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {selectedCourt?.name || "Court Score Recorder"}
        </CardTitle>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          Standard Court • Game to 11 (Win by 2)
        </p>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Error Notice */}
        {errorMessage && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 font-mono">
            {errorMessage}
          </div>
        )}

        {/* Step 1: Court Selection */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>1. SELECT COURT:</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              {courts.length} Courts Available
            </span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            {courts.map((court) => (
              <button
                key={court.id}
                type="button"
                onClick={() => handleSelectCourt(court)}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  selectedCourtId === court.id
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="font-bold">{court.name.replace(/\s*\(Rented Court\)/i, "")}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                  {court.status === "occupied" ? "🔴 In Play" : "🟢 Ready"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Format & Player Select (if not already active) */}
        {!isExistingLiveMatch ? (
          <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            {/* Auto-Call Queue Option */}
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center sm:justify-start gap-1.5">
                  <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Auto-Fill from Waiting Queue
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Automatically pull the next 4 queued players and balance teams by DUPR rating.
                </p>
              </div>

              <Button
                type="button"
                variant="volt"
                size="sm"
                onClick={handleAutoCallQueue}
                disabled={isPending}
                className="w-full sm:w-auto font-mono text-xs font-bold shrink-0 shadow-xs"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                {isPending ? "Assigning Players..." : `Call Next Up on ${selectedCourt?.name || "Court"}`}
              </Button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="text-xs font-mono text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                OR MANUALLY SELECT PLAYERS:
              </label>

              <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-0.5 font-mono text-xs shadow-inner">
                <button
                  type="button"
                  onClick={() => setFormat("doubles")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    format === "doubles"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Doubles (2v2)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("singles")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    format === "singles"
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Singles (1v1)
                </button>
              </div>
            </div>

            {/* Player Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Team 1 Select */}
              <div className="rounded-xl border border-emerald-500/30 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2.5">
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                  TEAM 1 PLAYERS
                </span>
                <select
                  value={teamA1}
                  onChange={(e) => setTeamA1(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                >
                  <option value="">-- Select Player 1 --</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.display_name} ({p.skill_rating.toFixed(2)})
                    </option>
                  ))}
                </select>

                {format === "doubles" && (
                  <select
                    value={teamA2}
                    onChange={(e) => setTeamA2(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                  >
                    <option value="">-- Select Player 2 --</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.display_name} ({p.skill_rating.toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Team 2 Select */}
              <div className="rounded-xl border border-sky-500/30 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2.5">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase">
                  TEAM 2 PLAYERS
                </span>
                <select
                  value={teamB1}
                  onChange={(e) => setTeamB1(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                >
                  <option value="">-- Select Player 1 --</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.display_name} ({p.skill_rating.toFixed(2)})
                    </option>
                  ))}
                </select>

                {format === "doubles" && (
                  <select
                    value={teamB2}
                    onChange={(e) => setTeamB2(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                  >
                    <option value="">-- Select Player 2 --</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.display_name} ({p.skill_rating.toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Step 3: Interactive Score Steppers */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
              {isExistingLiveMatch ? "RECORD MATCH SCORE:" : "3. ENTER FINAL SCORE:"}
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset 0 - 0
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Team 1 Score Box */}
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-slate-50 dark:bg-slate-950/70 p-5 space-y-3 text-center shadow-xs">
              <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                TEAM 1 POINTS
              </span>
              <div className="text-6xl font-black font-mono text-emerald-600 dark:text-emerald-400 py-1">
                {scoreA}
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => decrementScore("A")}
                  className="h-11 w-11 rounded-xl text-lg font-bold"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  onClick={() => incrementScore("A")}
                  className="h-11 w-11 rounded-xl text-lg font-bold shadow-md shadow-emerald-500/20"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Team 2 Score Box */}
            <div className="rounded-2xl border-2 border-sky-500/30 bg-slate-50 dark:bg-slate-950/70 p-5 space-y-3 text-center shadow-xs">
              <span className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                TEAM 2 POINTS
              </span>
              <div className="text-6xl font-black font-mono text-sky-600 dark:text-sky-400 py-1">
                {scoreB}
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => decrementScore("B")}
                  className="h-11 w-11 rounded-xl text-lg font-bold"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="volt"
                  size="icon"
                  onClick={() => incrementScore("B")}
                  className="h-11 w-11 rounded-xl text-lg font-bold shadow-md shadow-emerald-500/20"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <Button
            type="button"
            variant="volt"
            size="lg"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full font-bold text-sm h-12 shadow-md shadow-emerald-500/10"
          >
            <Trophy className="h-4 w-4 mr-2" />
            {isPending ? "Submitting Match..." : "Complete & Submit Match Score"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
