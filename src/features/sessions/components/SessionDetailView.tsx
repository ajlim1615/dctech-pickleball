"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Users, CheckCircle2, UserCheck, PlayCircle, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourtMatrix } from "@/features/courts/components/CourtMatrix";
import { checkInToSession } from "../api/sessionActions";
import { formatRating, cleanSessionDescription } from "@/lib/utils";
import type { Session, ActiveCourtView } from "@/types";

interface SessionDetailViewProps {
  session: Session & { checkins?: any[] };
  userRole?: string;
  userEmail?: string;
  currentUserId?: string;
  courts?: ActiveCourtView[];
}

export function SessionDetailView({
  session,
  userRole = "player",
  userEmail = "",
  currentUserId,
  courts,
}: SessionDetailViewProps) {
  const router = useRouter();
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = userRole === "admin" || isSystemAdmin;

  const isUserCheckedInDatabase = Boolean(
    !isSystemAdmin &&
    currentUserId &&
    session.checkins?.some(
      (c: any) => c.player_id === currentUserId || c.player?.id === currentUserId
    )
  );

  const [isCheckedIn, setIsCheckedIn] = useState(isUserCheckedInDatabase);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsCheckedIn(isUserCheckedInDatabase);
  }, [isUserCheckedInDatabase]);

  const checkins = session.checkins || [];

  async function handleCheckIn() {
    if (isSystemAdmin) return;
    setLoading(true);
    const res = await checkInToSession(session.id);
    if (!res?.error) {
      setIsCheckedIn(true);
      router.refresh();
    }
    setLoading(false);
  }

  const cleanedDescription = cleanSessionDescription(session.description);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-mono mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all sessions
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 backdrop-blur-md shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Badge variant={session.status === "active" ? "default" : "secondary"} className="text-xs font-mono">
                {session.status === "active" ? "● ACTIVE SESSION" : session.status.toUpperCase()}
              </Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(session.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                {new Date(session.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {session.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              {cleanedDescription || "DCTECH open play rotation on all facility courts."}
            </p>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                {session.location}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-[#d4e938]" />
                {checkins.length} Players Checked In
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isSystemAdmin ? (
              <Badge variant="outline" className="text-xs font-mono border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 py-2 px-3">
                🛡️ System Admin (Operator Mode)
              </Badge>
            ) : isCheckedIn ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono shadow-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  Checked In
                </div>
                <Link href="/queue">
                  <Button variant="volt" size="default" className="font-bold text-xs shadow-sm">
                    Enter Live Paddle Queue →
                  </Button>
                </Link>
              </div>
            ) : session.status === "active" ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="volt"
                  size="lg"
                  onClick={handleCheckIn}
                  disabled={loading}
                  className="font-bold text-sm shadow-sm"
                >
                  <UserCheck className="h-4 w-4 mr-1.5" />
                  {loading ? "Checking in..." : "Check In & Enter Queue"}
                </Button>
              </div>
            ) : null}

            {isAdmin && session.status === "active" && (
              <Button
                variant="outline"
                size="lg"
                onClick={async () => {
                  if (confirm("Are you sure you want to finish and complete this open-play session?")) {
                    await import("../api/sessionActions").then((m) =>
                      m.updateSessionStatus(session.id, "completed")
                    );
                    alert("Session marked as COMPLETED. All courts freed and rankings archived.");
                    window.location.reload();
                  }
                }}
                className="text-xs font-mono text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                Finish Session
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Checked-In Players Bar */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            Checked-in Players ({checkins.length})
          </CardTitle>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Auto queue priority active
          </span>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex flex-wrap gap-2">
            {checkins.map((c, i) => (
              <div
                key={c.id || i}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1 text-xs font-mono text-slate-700 dark:text-slate-200 shadow-2xs"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{c.player?.full_name || c.player?.display_name || "Employee"}</span>
                {c.player?.skill_rating && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    ({formatRating(c.player.skill_rating)})
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Court Matrix + Unified Live Queue Link Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CourtMatrix initialCourts={courts} userRole={userRole} sessionId={session.id} />
        </div>

        {/* Live Queue Station Card */}
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                Live Paddle Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono">
                The full paddle rotation board, 4-player match pods, and partner pairings (+Coworker) are managed on the dedicated Queue screen.
              </p>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span>Queue Format:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">4-On / 4-Off FIFO</span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span>Matching Style:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">Balanced DUPR</span>
                </div>
              </div>

              <Link href="/queue" className="block w-full">
                <Button variant="volt" className="w-full font-bold text-xs shadow-sm">
                  Open Live Queue Board <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
