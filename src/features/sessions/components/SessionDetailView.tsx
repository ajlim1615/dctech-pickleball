"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  UserCheck,
  PlayCircle,
  Zap,
  ExternalLink,
  Eye,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourtMatrix } from "@/features/courts/components/CourtMatrix";
import { SessionLeaderboard } from "./SessionLeaderboard";
import { SessionQueueLiveBoard } from "./SessionQueueLiveBoard";
import { FinalStandingsModal } from "./FinalStandingsModal";
import {
  checkInToSession,
  updateSessionStatus,
  type SessionRankedPlayer,
} from "../api/sessionActions";
import { formatRating, cleanSessionDescription } from "@/lib/utils";
import type { Session, ActiveCourtView, QueueEntryWithPlayer, Profile } from "@/types";

interface SessionDetailViewProps {
  session: Session & { checkins?: any[] };
  userRole?: string;
  userEmail?: string;
  currentUserId?: string;
  courts?: ActiveCourtView[];
  initialLeaderboard?: SessionRankedPlayer[];
  initialMatches?: any[];
  initialQueue?: QueueEntryWithPlayer[];
  employees?: Profile[];
}

export function SessionDetailView({
  session,
  userRole = "player",
  userEmail = "",
  currentUserId,
  courts,
  initialLeaderboard = [],
  initialMatches = [],
  initialQueue = [],
  employees = [],
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
  const [showCheckedInList, setShowCheckedInList] = useState(false);
  const [searchCheckin, setSearchCheckin] = useState("");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showFinalStandings, setShowFinalStandings] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    setIsCheckedIn(isUserCheckedInDatabase);
  }, [isUserCheckedInDatabase]);

  const checkins = session.checkins || [];
  const filteredCheckins = useMemo(() => {
    const query = searchCheckin.trim().toLowerCase();
    if (!query) return checkins;
    return checkins.filter((c) => {
      const name = (c.player?.full_name || c.player?.display_name || "").toLowerCase();
      return name.includes(query);
    });
  }, [checkins, searchCheckin]);

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

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5 shrink-0">
                <MapPin className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <span>{session.location}</span>
              </span>

              {checkins.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchCheckin("");
                    setShowCheckedInList(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-2xs cursor-pointer select-none"
                  title="Click to view all checked-in players"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">{checkins.length}</span>
                    <span>Players Checked In</span>
                  </span>
                  <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Eye className="h-3 w-3" />
                    <span>View Roster</span>
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>0 Players Checked In</span>
                </span>
              )}
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
                onClick={() => setShowFinishConfirm(true)}
                className="text-xs font-mono text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
              >
                Finish Session
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Finish Session Confirmation Modal */}
      {showFinishConfirm && (
        <div
          onClick={() => setShowFinishConfirm(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl cursor-default"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Finish {session.title} Session
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Are you sure you want to finish and complete this session?
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFinishConfirm(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFinishConfirm(false)}
                disabled={isFinishing}
                className="font-semibold text-xs"
              >
                Keep Playing
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={isFinishing}
                onClick={async () => {
                  setIsFinishing(true);
                  await updateSessionStatus(session.id, "completed");
                  setShowFinishConfirm(false);
                  setIsFinishing(false);
                  setShowFinalStandings(true);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                {isFinishing ? "Completing..." : "Finish & Archive Session"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Final Session Standings Modal Screen */}
      {showFinalStandings && (
        <FinalStandingsModal
          sessionTitle={session.title}
          rankings={initialLeaderboard}
          totalGames={initialMatches.length}
          onClose={() => {
            setShowFinalStandings(false);
            router.refresh();
            window.location.reload();
          }}
        />
      )}

      {/* Checked-In Players Pop-Up Modal */}
      {showCheckedInList && (
        <div
          onClick={() => setShowCheckedInList(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl overflow-hidden cursor-default"
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800/80 shrink-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      Checked-In Attendees
                      <Badge variant="default" className="text-[10px] font-mono font-bold py-0.5">
                        {checkins.length} Active
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {session.title} • {session.location}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCheckedInList(false)}
                  className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search checked-in attendee..."
                  value={searchCheckin}
                  onChange={(e) => setSearchCheckin(e.target.value)}
                  autoFocus
                  className="h-9 w-full pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
                {searchCheckin && (
                  <button
                    type="button"
                    onClick={() => setSearchCheckin("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-mono"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Attendees Scrollable List */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-2">
              {filteredCheckins.length === 0 ? (
                <div className="py-12 text-center font-mono text-xs text-slate-400 space-y-2">
                  <Users className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-slate-600 dark:text-slate-400 font-semibold">
                    No attendees match &quot;{searchCheckin}&quot;
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Try searching by another coworker name.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredCheckins.map((c, i) => {
                    const playerName = c.player?.full_name || c.player?.display_name || "Employee";
                    const isCurrentUser = currentUserId && (c.player_id === currentUserId || c.player?.id === currentUserId);
                    const initials = playerName.slice(0, 2).toUpperCase();

                    return (
                      <div
                        key={c.id || i}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                          isCurrentUser
                            ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-xs"
                            : "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                              <span>{playerName}</span>
                              {isCurrentUser && (
                                <Badge variant="volt" className="text-[9px] font-mono py-0 px-1">
                                  YOU
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              {c.player?.email || "Checked In"}
                            </div>
                          </div>
                        </div>

                        {c.player?.skill_rating ? (
                          <Badge variant="outline" className="text-[10px] font-mono font-bold shrink-0">
                            ★ {formatRating(c.player.skill_rating)}
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0 px-5">
              <span>Showing {filteredCheckins.length} of {checkins.length} players</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCheckedInList(false)}
                className="text-xs font-mono"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Court Matrix + Unified Live Queue Link Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CourtMatrix initialCourts={courts} userRole={userRole} sessionId={session.id} />
        </div>

        {/* Live Queue Station Card */}
        <div>
          <SessionQueueLiveBoard
            initialQueue={initialQueue}
            sessionId={session.id}
            currentUserId={currentUserId}
            userRole={userRole}
            userEmail={userEmail}
            employees={employees}
            isSessionActive={session.status === "active"}
          />
        </div>
      </div>

      {/* Session Leaderboard & Match Logs */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <SessionLeaderboard
          initialRankings={initialLeaderboard}
          matches={initialMatches}
          sessionTitle={session.title}
          isSessionActive={session.status === "active"}
        />
      </div>
    </div>
  );
}
