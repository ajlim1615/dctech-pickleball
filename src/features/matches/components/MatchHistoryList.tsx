"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Trophy, PlayCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPHTDateTime } from "@/lib/timezone";
import { formatMatchDuration } from "@/lib/duration";
import { isResultOnlyScore } from "@/features/matches/utils/scoring";

interface RawMatchPlayer {
  team?: string | null;
  player?: { full_name?: string | null; display_name?: string | null } | null;
  profile?: { full_name?: string | null } | null;
}

interface RawMatch {
  id: string;
  court?: { name?: string | null } | string | null;
  format?: string | null;
  players?: RawMatchPlayer[] | unknown;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winning_team?: "team_a" | "team_b" | "tie" | null;
  ended_at?: string | null;
  started_at?: string | null;
  created_at?: string | null;
}

export interface MatchItem {
  id: string;
  courtName: string;
  format: string;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  /** Win/loss-only game: show W/L instead of 1-0. */
  resultOnly: boolean;
  winner: "team_a" | "team_b" | "tie";
  date: string;
  duration?: string;
}

interface MatchHistoryListProps {
  initialMatches?: Array<MatchItem | RawMatch>;
}

export function MatchHistoryList({ initialMatches = [] }: MatchHistoryListProps) {
  const matches: MatchItem[] = useMemo(() => {
    return initialMatches.map((raw) => {
      // If already formatted MatchItem
      if ("teamA" in raw && Array.isArray(raw.teamA) && Array.isArray(raw.teamB)) {
        return raw;
      }

      const m = raw as RawMatch;
      // Raw Match from DB
      const courtName =
        typeof m.court === "string" ? m.court : m.court?.name || "Court";
      const format = m.format === "doubles" ? "Doubles (2v2)" : "Singles (1v1)";
      const players = Array.isArray(m.players) ? (m.players as RawMatchPlayer[]) : [];
      const teamAPlayers: string[] = players
        .filter((p) => p.team === "team_a")
        .map((p) => p.player?.full_name || p.player?.display_name || p.profile?.full_name || "Player");
      const teamBPlayers: string[] = players
        .filter((p) => p.team === "team_b")
        .map((p) => p.player?.full_name || p.player?.display_name || p.profile?.full_name || "Player");

      const scoreA = m.team_a_score ?? 0;
      const scoreB = m.team_b_score ?? 0;
      const winner = m.winning_team || (scoreA > scoreB ? "team_a" : scoreB > scoreA ? "team_b" : "tie");
      const dateSource = m.ended_at || m.started_at || m.created_at;
      const date = dateSource ? formatPHTDateTime(dateSource) : "Recent";
      const duration = formatMatchDuration(m.started_at, m.ended_at) ?? undefined;

      return {
        id: m.id,
        courtName,
        format,
        teamA: teamAPlayers.length > 0 ? teamAPlayers : ["Team 1"],
        teamB: teamBPlayers.length > 0 ? teamBPlayers : ["Team 2"],
        scoreA,
        scoreB,
        resultOnly: isResultOnlyScore(scoreA, scoreB),
        winner,
        date,
        duration,
      };
    });
  }, [initialMatches]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Trophy className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
            Results
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Every finished game, newest first.</p>
        </div>

        <Link
          href="/sessions"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <PlayCircle className="h-4 w-4" />
          Sessions
        </Link>
      </div>

      <div className="space-y-4">
        {matches.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-12 text-center space-y-3 text-sm text-slate-500 dark:text-slate-400 shadow-sm">
            <Trophy className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">No games yet</p>
            <p className="text-slate-500 max-w-sm mx-auto">
              Finished games show up here as soon as a result is saved.
            </p>
            <Link
              href="/sessions"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 font-bold text-slate-950 text-xs hover:bg-emerald-400 shadow-sm"
            >
              Go to Sessions
            </Link>
          </Card>
        ) : (
          matches.map((m) => {
            return (
              <Card key={m.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <Badge variant="secondary" className="text-[10px]">
                        {m.courtName}
                      </Badge>
                      <span>•</span>
                      <span>{m.format}</span>
                      <span>•</span>
                      <span>{m.date}</span>
                      {m.duration && (
                        <>
                          <span>•</span>
                          <span className="font-mono tabular-nums">{m.duration}</span>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Team 1{m.winner === "team_a" ? " · won" : ""}
                        </span>
                        {m.teamA.map((name, i) => (
                          <div key={i} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {name}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                          Team 2{m.winner === "team_b" ? " · won" : ""}
                        </span>
                        {m.teamB.map((name, i) => (
                          <div key={i} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono tabular-nums sm:border-l sm:border-slate-200 dark:sm:border-slate-800/80 sm:pl-6">
                    <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                      <span className={m.winner === "team_a" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}>
                        {m.resultOnly ? (m.scoreA > m.scoreB ? "W" : "L") : m.scoreA}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 mx-1">:</span>
                      <span className={m.winner === "team_b" ? "text-sky-600 dark:text-sky-400" : "text-slate-700 dark:text-slate-300"}>
                        {m.resultOnly ? (m.scoreB > m.scoreA ? "W" : "L") : m.scoreB}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Saved
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
