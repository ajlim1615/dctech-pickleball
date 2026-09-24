"use client";

import Link from "next/link";
import { Calendar, MapPin, Users, PlayCircle, Clock, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cleanSessionDescription } from "@/lib/utils";
import { formatPHTDate, formatPHTTime } from "@/lib/timezone";
import type { Session } from "@/types";

interface SessionListProps {
  initialSessions: Session[];
  userRole?: string;
}

export function SessionList({ initialSessions, userRole = "player" }: SessionListProps) {
  const isAdmin = userRole === "admin";
  const sessions: Session[] = initialSessions;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <PlayCircle className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
            Pickleball Sessions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            Upcoming and completed DCTECH open-play schedule
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold px-4 py-2 text-xs hover:bg-emerald-400 shadow-sm"
          >
            Create Session in Admin Panel
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-12 text-center space-y-3 font-mono text-xs text-slate-500 dark:text-slate-400 shadow-sm">
            <Calendar className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">No Open-Play Sessions Found</p>
            <p className="text-slate-500 max-w-sm mx-auto">
              {isAdmin
                ? "There are currently no scheduled or active sessions. Administrators can schedule a new session from the Admin Panel."
                : "There are currently no scheduled open-play sessions. Please check back later or check with your recreation organizer."}
            </p>
          </Card>
        ) : (
          sessions.map((s) => {
            const isActive = s.status === "active";
            const isCompleted = s.status === "completed";
            const isScheduled = s.status === "scheduled";
            const isCancelled = s.status === "cancelled";
            const cleanedDesc = cleanSessionDescription(s.description);

            return (
              <Card
                key={s.id}
                className={`border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-sm ${
                  isActive
                    ? "border-emerald-500/50 ring-1 ring-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : isCompleted
                    ? "opacity-80 bg-slate-50/50 dark:bg-slate-950/30"
                    : ""
                }`}
              >
                <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Status Indicator Badges */}
                      {isActive && (
                        <Badge variant="default" className="text-xs font-mono font-bold flex items-center gap-1.5 bg-emerald-500 text-slate-950">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
                          </span>
                          LIVE NOW • ACTIVE
                        </Badge>
                      )}

                      {isScheduled && (
                        <Badge variant="outline" className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          UPCOMING • SCHEDULED
                        </Badge>
                      )}

                      {isCompleted && (
                        <Badge variant="secondary" className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          COMPLETED
                        </Badge>
                      )}

                      {isCancelled && (
                        <Badge variant="destructive" className="text-xs font-mono font-bold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          CANCELLED
                        </Badge>
                      )}

                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatPHTDate(s.start_time)} • {formatPHTTime(s.start_time)} – {formatPHTTime(s.end_time)} (PHT)
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{s.title}</h3>
                    {cleanedDesc && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 max-w-2xl">
                        {cleanedDesc}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        {s.location}
                      </span>
                      {s.max_players && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-[#d4e938]" />
                          Cap: {s.max_players} players
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={`/sessions/${s.id}`}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all shadow-xs ${
                        isActive
                          ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold"
                          : "border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>{isActive ? "View Live Board" : isCompleted ? "View Results & Courts" : "View Session"}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
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
