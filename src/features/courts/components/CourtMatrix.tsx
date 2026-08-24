"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Activity, Clock, Zap, ShieldCheck, PlayCircle, Filter } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourtStatusIndicator } from "@/components/layout/CourtStatusIndicator";
import { callNextUp } from "@/features/queue/api/queueActions";
import type { CourtStatus } from "@/types/database.types";
import type { ActiveCourtView } from "@/types";

interface MockCourt {
  id: string;
  name: string;
  surface: string;
  status: CourtStatus;
  staffMonitor?: string;
  game?: {
    matchType: string;
    teamA: string[];
    teamB: string[];
    scoreA: number;
    scoreB: number;
    duration: string;
    serverNotation?: string;
    startedAt?: string;
  };
}

const defaultFreshCourts: MockCourt[] = [
  {
    id: "1",
    name: "Court 1",
    surface: "Standard Court",
    status: "available",
  },
  {
    id: "2",
    name: "Court 2",
    surface: "Standard Court",
    status: "available",
  },
  {
    id: "3",
    name: "Court 3",
    surface: "Standard Court",
    status: "available",
  },
  {
    id: "4",
    name: "Court 4",
    surface: "Standard Court",
    status: "available",
  },
];

interface CourtMatrixProps {
  initialCourts?: ActiveCourtView[];
  userRole?: string;
  sessionId?: string;
}

function CourtInPlayClock({ startedAt }: { startedAt?: string }) {
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
    <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 shadow-sm">
      <Clock className="h-3 w-3 text-emerald-600 dark:text-[#d4e938] animate-pulse" />
      <span className="text-emerald-700 dark:text-[#d4e938]">⏱️ {elapsed}</span>
    </div>
  );
}

export function CourtMatrix({ initialCourts, userRole = "player", sessionId }: CourtMatrixProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "occupied" | "available">("all");
  const [callingCourtId, setCallingCourtId] = useState<string | null>(null);
  const isAdmin = userRole === "admin";

  async function handleCallCourt(courtId: string) {
    setCallingCourtId(courtId);
    if (sessionId) {
      const res = await callNextUp(sessionId, courtId, 4);
      if (res?.error) {
        alert(`Queue notice: ${res.error}`);
      } else {
        router.refresh();
      }
    }
    setCallingCourtId(null);
  }

  const courtsToDisplay: MockCourt[] = useMemo(() => {
    return initialCourts !== undefined
      ? initialCourts.map((c) => ({
          id: c.id,
          name: c.name,
          surface: c.surface_type || "Standard Court",
          status: c.status,
          staffMonitor: c.assigned_staff?.full_name
            ? `${c.assigned_staff.full_name} (Sports Staff)`
            : undefined,
          game: c.current_match
            ? {
                matchType:
                  c.current_match.format === "doubles"
                    ? "DOUBLES OPEN"
                    : "SINGLES CHALLENGE",
                teamA: c.current_match.players
                  .filter((p) => p.team === "team_a")
                  .map((p) => (p as any).profile?.full_name || (p as any).player?.full_name || "Player"),
                teamB: c.current_match.players
                  .filter((p) => p.team === "team_b")
                  .map((p) => (p as any).profile?.full_name || (p as any).player?.full_name || "Player"),
                scoreA: c.current_match.team_a_score || 0,
                scoreB: c.current_match.team_b_score || 0,
                duration: "Active",
                serverNotation: `${c.current_match.team_a_score || 0} - ${c.current_match.team_b_score || 0} - ${(c.current_match as any).server_number || 2}`,
                startedAt: c.current_match.started_at || undefined,
              }
            : undefined,
        }))
      : defaultFreshCourts;
  }, [initialCourts]);

  const filteredCourts = useMemo(() => {
    return courtsToDisplay.filter((c) => {
      if (filter === "all") return true;
      return c.status === filter;
    });
  }, [courtsToDisplay, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            Live Court Matrix
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time court status & live staff umpire scoreboards
          </p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-2.5 py-1 border transition-colors ${
              filter === "all"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold"
                : "border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            All ({courtsToDisplay.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("occupied")}
            className={`rounded-md px-2.5 py-1 border transition-colors ${
              filter === "occupied"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold"
                : "border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            In Play ({courtsToDisplay.filter((c) => c.status === "occupied").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("available")}
            className={`rounded-md px-2.5 py-1 border transition-colors ${
              filter === "available"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold"
                : "border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Ready ({courtsToDisplay.filter((c) => c.status === "available").length})
          </button>
        </div>
      </div>

      {filteredCourts.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-12 text-center space-y-3 font-mono text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          <Activity className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto" />
          <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">No Courts Configured</p>
          <p className="text-slate-500 max-w-sm mx-auto">
            Schedule a session in the Session Scheduler to automatically provision rented courts for today.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCourts.map((court) => {
          const isOccupied = court.status === "occupied" && court.game;
          return (
            <Card
              key={court.id}
              className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
            >
              <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {court.name.replace(/\s*\(Rented Court\)/i, "")}
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Standard Court
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {court.status === "occupied" && (
                    <CourtInPlayClock startedAt={court.game?.startedAt} />
                  )}
                  <CourtStatusIndicator status={court.status} />
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3">
                {/* Staff Monitor Tag */}
                <div className="flex items-center justify-between text-[11px] font-mono border-b border-slate-200 dark:border-slate-800/50 pb-2">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Monitor: <span className="text-slate-800 dark:text-slate-200 font-medium">{court.staffMonitor || "Assigned Staff"}</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {court.surface}
                  </span>
                </div>

                {isOccupied ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                      <span>{court.game?.matchType}</span>
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <Clock className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        {court.game?.duration}
                      </span>
                    </div>

                    {/* Scoreboard Card (Responsive & Overflow-Safe) */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 p-3">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
                        {/* Team 1 (Left) */}
                        <div className="min-w-0 space-y-1">
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-wider uppercase">
                            TEAM 1
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            {court.game?.teamA.map((p, idx) => (
                              <div
                                key={idx}
                                className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate"
                                title={p}
                              >
                                {p}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Center Score */}
                        <div className="shrink-0 px-1 sm:px-3 text-center">
                          <div className="rounded-lg bg-white dark:bg-slate-900 px-2.5 py-1 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1">
                              <span className="text-emerald-600 dark:text-emerald-400">{court.game?.scoreA}</span>
                              <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                              <span className="text-sky-600 dark:text-sky-400">{court.game?.scoreB}</span>
                            </div>
                            <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              {court.game?.serverNotation ? court.game.serverNotation : "0 - 0 - 2"}
                            </div>
                          </div>
                        </div>

                        {/* Team 2 (Right) */}
                        <div className="min-w-0 text-right space-y-1">
                          <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 font-mono tracking-wider uppercase">
                            TEAM 2
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            {court.game?.teamB.map((p, idx) => (
                              <div
                                key={idx}
                                className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate"
                                title={p}
                              >
                                {p}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center space-y-1">
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Court Available & Ready
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                      {isAdmin
                        ? "Click below or visit Umpire Mode to call up the next waiting pod."
                        : "Next pod rotation will be called up shortly."}
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="pt-1">
                    {isOccupied ? (
                      <a
                        href={`/courts/${court.id}/monitor`}
                        className="w-full inline-flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold text-emerald-800 dark:text-emerald-300 py-2 transition-colors font-mono shadow-xs"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                        Open Live Umpire Scoreboard →
                      </a>
                    ) : (
                      <Button
                        type="button"
                        variant="volt"
                        size="sm"
                        disabled={callingCourtId === court.id}
                        onClick={() => handleCallCourt(court.id)}
                        className="w-full font-bold text-xs font-mono shadow-xs"
                      >
                        <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                        {callingCourtId === court.id
                          ? "Calling Queued Pod..."
                          : `Call Next Up on ${court.name}`}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
