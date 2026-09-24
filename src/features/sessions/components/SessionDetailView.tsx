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
  Check,
  UserPlus,
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
import { bulkAddPlayersToQueue } from "@/features/queue/api/queueActions";
import { createWalkInPlayer } from "@/features/admin/api/adminActions";
import { formatRating, cleanSessionDescription, parseSessionMetadata } from "@/lib/utils";
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

  const [currentStatus, setCurrentStatus] = useState<Session["status"]>(session.status);
  const [statusLoading, setStatusLoading] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(isUserCheckedInDatabase);
  const [loading, setLoading] = useState(false);
  const [showCheckedInList, setShowCheckedInList] = useState(false);
  const [searchCheckin, setSearchCheckin] = useState("");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showFinalStandings, setShowFinalStandings] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Bulk Queue & Walk-In Modal States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [modalTab, setModalTab] = useState<"roster" | "walkin">("roster");
  const [bulkSearch, setBulkSearch] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Walk-In Form State
  const [walkInName, setWalkInName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInRating, setWalkInRating] = useState<number>(3.0);
  const [walkInIsGuest, setWalkInIsGuest] = useState(true);
  const [walkInAutoQueue, setWalkInAutoQueue] = useState(true);
  const [isCreatingWalkIn, setIsCreatingWalkIn] = useState(false);

  const sessionMeta = useMemo(() => parseSessionMetadata(session.description), [session.description]);

  useEffect(() => {
    setIsCheckedIn(isUserCheckedInDatabase);
  }, [isUserCheckedInDatabase]);

  useEffect(() => {
    setCurrentStatus(session.status);
  }, [session.status]);

  const checkins = session.checkins || [];
  const filteredCheckins = useMemo(() => {
    const query = searchCheckin.trim().toLowerCase();
    if (!query) return checkins;
    return checkins.filter((c) => {
      const name = (c.player?.full_name || c.player?.display_name || "").toLowerCase();
      return name.includes(query);
    });
  }, [checkins, searchCheckin]);

  const eligibleEmployees = useMemo(() => {
    return employees.filter(
      (e) => e.email?.toLowerCase() !== "admin@dctechmicro.com"
    );
  }, [employees]);

  const currentlyQueuedIds = useMemo(() => {
    return new Set(initialQueue.map((q) => q.player_id));
  }, [initialQueue]);

  const filteredEmployees = useMemo(() => {
    const query = bulkSearch.trim().toLowerCase();
    if (!query) return eligibleEmployees;
    return eligibleEmployees.filter((e) => {
      const name = (e.full_name || e.display_name || "").toLowerCase();
      const email = (e.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [eligibleEmployees, bulkSearch]);

  function togglePlayerSelection(playerId: string) {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  }

  function handleSelectAllAvailable() {
    const availableIds = filteredEmployees
      .filter((e) => !currentlyQueuedIds.has(e.id))
      .map((e) => e.id);
    setSelectedPlayerIds(availableIds);
  }

  function handleClearSelection() {
    setSelectedPlayerIds([]);
  }

  async function handleBulkQueueSubmit() {
    if (!session.id || selectedPlayerIds.length === 0) return;
    setIsBulkAdding(true);
    const res = await bulkAddPlayersToQueue(session.id, selectedPlayerIds);
    if (res?.error) {
      alert(`Error queueing players: ${res.error}`);
    } else {
      setSelectedPlayerIds([]);
      setShowBulkModal(false);
      router.refresh();
    }
    setIsBulkAdding(false);
  }

  async function handleCreateWalkIn(e: React.FormEvent) {
    e.preventDefault();
    if (!walkInName.trim()) return;
    setIsCreatingWalkIn(true);
    const res = await createWalkInPlayer({
      fullName: walkInName.trim(),
      email: !walkInIsGuest && walkInEmail.trim() ? walkInEmail.trim() : undefined,
      isGuest: walkInIsGuest,
      skillRating: walkInRating,
    });
    if (res?.error || !res?.player) {
      alert(`Error creating walk-in player: ${res?.error || "Unknown error"}`);
    } else {
      if (walkInAutoQueue) {
        await bulkAddPlayersToQueue(session.id, [res.player.id]);
      }
      setWalkInName("");
      setWalkInEmail("");
      setShowBulkModal(false);
      router.refresh();
    }
    setIsCreatingWalkIn(false);
  }

  async function handleStartSession() {
    setStatusLoading(true);
    const res = await updateSessionStatus(session.id, "active");
    if (res?.error) {
      alert(`Error starting session: ${res.error}`);
    } else {
      setCurrentStatus("active");
      router.refresh();
    }
    setStatusLoading(false);
  }

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
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 pb-28 sm:pb-12">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-mono mb-3.5 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all sessions
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 sm:p-6 backdrop-blur-md shadow-sm overflow-hidden">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <Badge
                variant={currentStatus === "active" ? "default" : "secondary"}
                className={`text-xs font-mono font-bold ${
                  currentStatus === "active"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs"
                    : currentStatus === "completed"
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                }`}
              >
                {currentStatus === "active"
                  ? "● LIVE ACTIVE SESSION"
                  : currentStatus === "completed"
                  ? "COMPLETED"
                  : "SCHEDULED"}
              </Badge>

              {parseSessionMetadata(session.description).isRanked ? (
                <Badge variant="volt" className="text-[10px] font-mono font-bold">
                  🏆 Ranked Open Play
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 shadow-2xs">
                  🍃 Casual / Lowkey (Unranked)
                </span>
              )}

              {parseSessionMetadata(session.description).targetPoints === 6 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 shadow-2xs">
                  ⚡ Speed Play (6 Pts)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                  🏆 Standard (11 Pts)
                </span>
              )}

              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {new Date(session.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                  {new Date(session.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {session.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/80">
            {/* Admin Session Lifecycle Controls */}
            {isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2.5 w-full md:w-auto">
                {currentStatus !== "active" && currentStatus !== "completed" ? (
                  <Button
                    variant="volt"
                    size="default"
                    onClick={handleStartSession}
                    disabled={statusLoading}
                    className="w-full md:w-auto font-bold text-xs sm:text-sm shadow-md cursor-pointer h-11 sm:h-10 px-4 justify-center"
                  >
                    <PlayCircle className="h-4 w-4 mr-1.5 shrink-0" />
                    <span>{statusLoading ? "Starting..." : "Start Session"}</span>
                  </Button>
                ) : currentStatus === "active" ? (
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => setShowFinishConfirm(true)}
                    disabled={statusLoading}
                    className="w-full md:w-auto text-xs font-mono font-bold text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer shadow-xs h-11 sm:h-10 px-4 justify-center"
                  >
                    <span>⏹ End / Finish Session</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartSession}
                    disabled={statusLoading}
                    className="w-full md:w-auto text-xs font-mono text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 h-11 sm:h-9 justify-center"
                  >
                    <span>Reopen Session</span>
                  </Button>
                )}

                {/* Add / Bulk Queue Players Header Button */}
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => {
                    setSelectedPlayerIds([]);
                    setBulkSearch("");
                    setModalTab("roster");
                    setShowBulkModal(true);
                  }}
                  className="w-full md:w-auto font-bold text-xs sm:text-sm border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 cursor-pointer shadow-xs h-11 sm:h-10 px-4 flex items-center justify-center whitespace-nowrap"
                >
                  <Users className="h-4 w-4 mr-1.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>+ Add / Queue Players</span>
                </Button>
              </div>
            )}

            {/* Non-Admin Player Check-in / Enter Queue Buttons */}
            {!isSystemAdmin && (
              isCheckedIn ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono shadow-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Checked In</span>
                  </div>
                  <a href="#live-queue-station" className="w-full sm:w-auto">
                    <Button variant="volt" size="default" className="w-full sm:w-auto font-bold text-xs shadow-sm h-11 sm:h-10">
                      <span>Enter Live Paddle Queue →</span>
                    </Button>
                  </a>
                </div>
              ) : currentStatus === "active" ? (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button
                    variant="volt"
                    size="default"
                    onClick={handleCheckIn}
                    disabled={loading}
                    className="w-full sm:w-auto font-bold text-xs sm:text-sm shadow-sm h-11 sm:h-10 justify-center"
                  >
                    <UserCheck className="h-4 w-4 mr-1.5 shrink-0" />
                    <span>{loading ? "Checking in..." : "Check In & Enter Queue"}</span>
                  </Button>
                </div>
              ) : null
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
                  const res = await updateSessionStatus(session.id, "completed");
                  if (res?.error) {
                    alert(`Error completing session: ${res.error}`);
                  } else {
                    setCurrentStatus("completed");
                    setShowFinishConfirm(false);
                    setShowFinalStandings(true);
                    router.refresh();
                  }
                  setIsFinishing(false);
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

      {/* Admin Add / Bulk Queue Modal - Top Level Root Component */}
      {showBulkModal && (
        <div
          onClick={() => setShowBulkModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden cursor-default"
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                        Add Players to Queue
                      </h3>
                      {modalTab === "roster" && (
                        <Badge variant="volt" className="text-[10px] font-mono font-bold py-0.5 px-2">
                          {selectedPlayerIds.length} Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {session.title} • Live Paddle Station
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 -mb-4 pt-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setModalTab("roster")}
                  className={`pb-3 text-xs font-mono font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    modalTab === "roster"
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Coworker Roster ({eligibleEmployees.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("walkin")}
                  className={`pb-3 text-xs font-mono font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                    modalTab === "walkin"
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>+ Walk-In / Guest</span>
                </button>
              </div>
            </div>

            {/* TAB 1: COWORKER BULK QUEUE */}
            {modalTab === "roster" && (
              <>
                {/* Search & Actions Bar */}
                <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search coworker name or email..."
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      autoFocus
                      className="h-10 w-full pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                    {bulkSearch && (
                      <button
                        type="button"
                        onClick={() => setBulkSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-mono"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllAvailable}
                    className="text-xs font-mono shrink-0 h-10 font-semibold cursor-pointer"
                  >
                    Select All
                  </Button>
                  {selectedPlayerIds.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearSelection}
                      className="text-xs font-mono text-rose-600 hover:text-rose-700 shrink-0 h-10 font-semibold cursor-pointer"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Players Scrollable List */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2">
                  {filteredEmployees.length === 0 ? (
                    <div className="py-12 text-center font-mono text-xs text-slate-400 space-y-2">
                      <Users className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400">
                        No coworkers match &quot;{bulkSearch}&quot;
                      </p>
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isQueued = currentlyQueuedIds.has(emp.id);
                      const isSelected = selectedPlayerIds.includes(emp.id);
                      const playerName = emp.full_name || emp.display_name || "Employee";
                      const initials = playerName.slice(0, 2).toUpperCase();

                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            if (!isQueued) togglePlayerSelection(emp.id);
                          }}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            isQueued
                              ? "opacity-50 bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                              : isSelected
                              ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 cursor-pointer shadow-xs"
                              : "border-slate-200 dark:border-slate-800/80 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 cursor-pointer bg-slate-50/50 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-950"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                isSelected
                                  ? "bg-emerald-500 border-emerald-500 text-white shadow-2xs"
                                  : isQueued
                                  ? "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400"
                                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {isQueued && <Check className="h-3 w-3" />}
                            </div>

                            <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                              {initials}
                            </div>

                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {playerName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                {emp.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isQueued ? (
                              <Badge variant="outline" className="text-[10px] font-mono text-slate-400 border-slate-300 dark:border-slate-700">
                                Already Queued
                              </Badge>
                            ) : emp.skill_rating ? (
                              <Badge variant="outline" className="text-[10px] font-mono font-bold">
                                ★ {formatRating(emp.skill_rating)}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono shrink-0 px-6">
                  <span className="text-slate-500 dark:text-slate-400">
                    {selectedPlayerIds.length} coworker{selectedPlayerIds.length !== 1 ? "s" : ""} selected
                  </span>
                  <div className="flex items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkModal(false)}
                      disabled={isBulkAdding}
                      className="cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="volt"
                      size="default"
                      disabled={selectedPlayerIds.length === 0 || isBulkAdding}
                      onClick={handleBulkQueueSubmit}
                      className="font-bold shadow-sm cursor-pointer px-4"
                    >
                      {isBulkAdding ? "Queueing..." : `Queue Selected (${selectedPlayerIds.length})`}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: WALK-IN / GUEST CREATION FORM */}
            {modalTab === "walkin" && (
              <form onSubmit={handleCreateWalkIn} className="flex flex-col flex-1 overflow-y-auto">
                <div className="p-6 space-y-5 flex-1">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      Player / Guest Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jordan Miller, Alex Tan"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      autoFocus
                      className="h-10 w-full px-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>

                  {/* Player Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      Player Category
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWalkInIsGuest(true)}
                        className={`p-3 rounded-xl border text-left text-xs font-mono transition-all cursor-pointer ${
                          walkInIsGuest
                            ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <span>🏷️ External Guest / Visitor</span>
                        </div>
                        <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                          Appends &quot;(Guest)&quot; to name automatically
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWalkInIsGuest(false)}
                        className={`p-3 rounded-xl border text-left text-xs font-mono transition-all cursor-pointer ${
                          !walkInIsGuest
                            ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <span>🏢 Internal Coworker</span>
                        </div>
                        <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                          Unregistered or walk-in employee
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Optional Work Email for Internal Coworkers */}
                  {!walkInIsGuest && (
                    <div className="space-y-1.5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          DCTECH Work Email
                        </label>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                          Optional (auto-generated if empty)
                        </span>
                      </div>
                      <input
                        type="email"
                        value={walkInEmail}
                        onChange={(e) => setWalkInEmail(e.target.value)}
                        placeholder="e.g. michael.chen@dctechmicro.com"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-mono"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        Syncs match history and DUPR automatically when they log in with this email.
                      </p>
                    </div>
                  )}

                  {/* Skill Rating / DUPR Level */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Estimated Skill Rating (DUPR)
                      </label>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        ★ {walkInRating.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { label: "2.0 Beg", value: 2.0 },
                        { label: "2.5 Nov", value: 2.5 },
                        { label: "3.0 Int", value: 3.0 },
                        { label: "3.5 Adv", value: 3.5 },
                        { label: "4.0+ Pro", value: 4.0 },
                      ].map((tier) => (
                        <button
                          key={tier.value}
                          type="button"
                          onClick={() => setWalkInRating(tier.value)}
                          className={`py-2 px-1 rounded-xl border text-center text-xs font-mono font-bold transition-all cursor-pointer ${
                            walkInRating === tier.value
                              ? "border-emerald-500 bg-emerald-500 text-white shadow-xs"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                          }`}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-Queue Checkbox */}
                  <div
                    onClick={() => setWalkInAutoQueue(!walkInAutoQueue)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer shadow-2xs select-none"
                  >
                    <div
                      className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                        walkInAutoQueue
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-2xs"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      }`}
                    >
                      {walkInAutoQueue && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                    <div className="text-xs font-mono">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        Check In & Queue Immediately
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Add this player straight to today&apos;s active paddle rack
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Footer */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono shrink-0 px-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkModal(false)}
                    disabled={isCreatingWalkIn}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="volt"
                    size="default"
                    disabled={!walkInName.trim() || isCreatingWalkIn}
                    className="font-bold shadow-sm cursor-pointer px-5"
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    {isCreatingWalkIn ? "Registering..." : "Create & Queue Walk-In"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Court Matrix + Unified Live Queue Link Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CourtMatrix
            initialCourts={courts}
            userRole={userRole}
            isAdmin={isAdmin}
            sessionId={session.id}
            queue={initialQueue}
            waitingQueueCount={initialQueue.filter((q) => q.status === "waiting").length}
          />
        </div>

        {/* Live Queue Station Card */}
        <div id="live-queue-station" className="scroll-mt-20">
          <SessionQueueLiveBoard
            initialQueue={initialQueue}
            sessionId={session.id}
            currentUserId={currentUserId}
            userRole={userRole}
            userEmail={userEmail}
            employees={employees}
            isSessionActive={currentStatus === "active"}
            matchingMode={sessionMeta.matchingMode}
            onOpenBulkQueue={() => {
              setSelectedPlayerIds([]);
              setBulkSearch("");
              setModalTab("roster");
              setShowBulkModal(true);
            }}
          />
        </div>
      </div>

      {/* Session Leaderboard & Match Logs */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <SessionLeaderboard
          initialRankings={initialLeaderboard}
          matches={initialMatches}
          sessionTitle={session.title}
          isSessionActive={currentStatus === "active"}
        />
      </div>
    </div>
  );
}
