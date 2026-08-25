"use client";

import { useMemo } from "react";
import { Trophy, Calendar, CheckCircle2, Clock, MapPin, Plus, PlayCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface MatchItem {
  id: string;
  courtName: string;
  format: string;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  winner: "team_a" | "team_b" | "tie";
  date: string;
  duration?: string;
}

interface MatchHistoryListProps {
  initialMatches?: any[];
}

export function MatchHistoryList({ initialMatches = [] }: MatchHistoryListProps) {
  const matches: MatchItem[] = useMemo(() => {
    return initialMatches.map((m: any) => {
      // If already formatted MatchItem
      if (Array.isArray(m.teamA) && Array.isArray(m.teamB)) {
        return m as MatchItem;
      }

      // Raw Match from DB
      const courtName = m.court?.name || (typeof m.court === "string" ? m.court : "Court");
      const format = m.format === "doubles" ? "Doubles (2v2)" : "Singles (1v1)";
      const teamAPlayers: string[] = (m.players || [])
        .filter((p: any) => p.team === "team_a")
        .map((p: any) => p.player?.full_name || p.player?.display_name || p.profile?.full_name || "Player");
      const teamBPlayers: string[] = (m.players || [])
        .filter((p: any) => p.team === "team_b")
        .map((p: any) => p.player?.full_name || p.player?.display_name || p.profile?.full_name || "Player");

      const scoreA = m.team_a_score ?? 0;
      const scoreB = m.team_b_score ?? 0;
      const winner = m.winning_team || (scoreA > scoreB ? "team_a" : scoreB > scoreA ? "team_b" : "tie");
      const dateSource = m.ended_at || m.started_at || m.created_at;
      const date = dateSource
        ? new Date(dateSource).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Recent";

      return {
        id: m.id,
        courtName,
        format,
        teamA: teamAPlayers.length > 0 ? teamAPlayers : ["Team 1"],
        teamB: teamBPlayers.length > 0 ? teamBPlayers : ["Team 2"],
        scoreA,
        scoreB,
        winner,
        date,
      };
    });
  }, [initialMatches]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Trophy className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
            Match Logs & Scores
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Recorded scores from all DCTECH open play games
          </p>
        </div>

        <a
          href="/sessions"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-slate-950 px-4 py-2 text-xs font-bold hover:bg-emerald-400 transition-colors font-mono shadow-sm"
        >
          <PlayCircle className="h-4 w-4" />
          Go to Active Session
        </a>
      </div>

      <div className="space-y-4">
        {matches.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-12 text-center space-y-3 font-mono text-xs text-slate-500 dark:text-slate-400 shadow-sm">
            <Trophy className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">No Matches Recorded Yet</p>
            <p className="text-slate-500 max-w-sm mx-auto">
              When sports staff or players record completed game scores on the session court matrix, match logs and head-to-head scorecards will appear here.
            </p>
            <a
              href="/sessions"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 font-bold text-slate-950 text-xs hover:bg-emerald-400 shadow-sm"
            >
              Go to Sessions
            </a>
          </Card>
        ) : (
          matches.map((m) => {
            return (
              <Card key={m.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      <Badge variant="secondary" className="text-[10px]">
                        {m.courtName}
                      </Badge>
                      <span>•</span>
                      <span>{m.format}</span>
                      <span>•</span>
                      <span>{m.date}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          TEAM 1 {m.winner === "team_a" ? "(WINNER)" : ""}
                        </span>
                        {m.teamA.map((name, i) => (
                          <div key={i} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {name}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-bold">
                          TEAM 2 {m.winner === "team_b" ? "(WINNER)" : ""}
                        </span>
                        {m.teamB.map((name, i) => (
                          <div key={i} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono sm:border-l sm:border-slate-200 dark:sm:border-slate-800/80 sm:pl-6">
                    <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                      <span className={m.winner === "team_a" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}>
                        {m.scoreA}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 mx-1">:</span>
                      <span className={m.winner === "team_b" ? "text-sky-600 dark:text-sky-400" : "text-slate-700 dark:text-slate-300"}>
                        {m.scoreB}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Score Verified
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
