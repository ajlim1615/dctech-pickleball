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
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { CourtMatrix } from "@/features/courts/components/CourtMatrix";
import { SessionLeaderboard } from "./SessionLeaderboard";
import { formatPHTDate, formatPHTTime } from "@/lib/timezone";
import { SessionQueueLiveBoard } from "./SessionQueueLiveBoard";
import { FinalStandingsModal } from "./FinalStandingsModal";
import { SessionConsoleBar, useAutoFillPreference } from "./SessionConsoleBar";
import { RsvpButton } from "./RsvpButton";
import { canRsvp } from "@/features/sessions/utils/rsvp";
import {
  checkInToSession,
  checkOutOfSession,
  updateSessionStatus,
  type SessionRankedPlayer,
} from "../api/sessionActions";
import { bulkAddPlayersToQueue } from "@/features/queue/api/queueActions";
import { createWalkInPlayer } from "@/features/admin/api/adminActions";
import { formatRating, cleanSessionDescription, parseSessionMetadata } from "@/lib/utils";
import type { Session, ActiveCourtView, QueueEntryWithPlayer, Profile, SessionEvent } from "@/types";
import type { PastGame } from "@/features/queue/matchmaking";
import { useLiveFeed } from "@/features/activity/hooks/useLiveFeed";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import { describeRule } from "@/features/matches/utils/scoring";

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
  /** People who said they're going (upcoming sessions). */
  rsvps?: { playerId: string; name: string }[];
  /** Session activity, newest first, and the average game length so far. */
  initialEvents?: SessionEvent[];
  avgGameMinutes?: number | null;
  /** Finished games, for the Up next preview. */
  history?: PastGame[];
}

const NO_RSVPS: { playerId: string; name: string }[] = [];
const NO_EVENTS: SessionEvent[] = [];

// Stable default: it is passed down to useLiveQueue, whose sync effect would
// loop on a fresh [] every render.
const EMPTY_QUEUE: QueueEntryWithPlayer[] = [];

export function SessionDetailView({
  session,
  userRole = "player",
  userEmail = "",
  currentUserId,
  courts,
  initialLeaderboard = [],
  initialMatches = [],
  initialQueue = EMPTY_QUEUE,
  employees = [],
  rsvps = NO_RSVPS,
  initialEvents = NO_EVENTS,
  avgGameMinutes = null,
  history,
}: SessionDetailViewProps) {
  const events = useLiveFeed(session.id, initialEvents);
  // Names for the activity feed: everyone the page knows about.
  const activityNames = useMemo(() => {
    const map: Record<string, string> = {};
    const add = (p?: { id?: string; full_name?: string | null; display_name?: string | null } | null) => {
      if (p?.id) map[p.id] = p.full_name || p.display_name || map[p.id] || "A player";
    };
    employees.forEach(add);
    (session.checkins || []).forEach((c: { player?: Profile }) => add(c.player));
    initialQueue.forEach((q) => add(q.player));
    (courts || []).forEach((c) => c.current_match?.players?.forEach((p) => add(p.profile)));
    return map;
  }, [employees, session.checkins, initialQueue, courts]);
  const iAmGoing = Boolean(currentUserId && rsvps.some((r) => r.playerId === currentUserId));
  const router = useRouter();
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = userRole === "admin" || isSystemAdmin;

  const [activeCheckins, setActiveCheckins] = useState<any[]>(session.checkins || []);
  const [checkingOutPlayerId, setCheckingOutPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setActiveCheckins(session.checkins || []);
  }, [session.checkins]);

  const isUserCheckedInDatabase = Boolean(
    !isSystemAdmin &&
    currentUserId &&
    activeCheckins.some(
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
  const [autoFill, setAutoFill] = useAutoFillPreference();

  function openAddPlayers() {
    setSelectedPlayerIds([]);
    setBulkSearch("");
    setModalTab("roster");
    setShowBulkModal(true);
  }

  useEffect(() => {
    setIsCheckedIn(isUserCheckedInDatabase);
  }, [isUserCheckedInDatabase]);

  useEffect(() => {
    setCurrentStatus(session.status);
  }, [session.status]);

  const checkins = activeCheckins;
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
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      const res = await updateSessionStatus(session.id, "active");
      if (res?.error) {
        alert(`Error starting session: ${res.error}`);
      } else {
        setCurrentStatus("active");
        router.refresh();
      }
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleCheckIn() {
    if (isSystemAdmin || loading) return;
    setLoading(true);
    try {
      const res = await checkInToSession(session.id);
      if (!res?.error) {
        setIsCheckedIn(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOutPlayer(targetPlayerId: string, playerName: string) {
    if (checkingOutPlayerId || !targetPlayerId) return;
    const isSelf = targetPlayerId === currentUserId;
    const confirmMessage = isSelf
      ? "Check out of this session? You will also be removed from the active queue."
      : `Check out ${playerName}? They will be removed from attendance and taken out of the queue.`;

    if (!confirm(confirmMessage)) return;

    setCheckingOutPlayerId(targetPlayerId);
    try {
      const res = await checkOutOfSession(session.id, targetPlayerId);
      if (res?.error) {
        alert(`Error checking out player: ${res.error}`);
      } else {
        // Optimistically remove from active checkins roster
        setActiveCheckins((prev) =>
          prev.filter(
            (c) => c.player_id !== targetPlayerId && c.player?.id !== targetPlayerId
          )
        );
        if (isSelf) {
          setIsCheckedIn(false);
        }
        router.refresh();
      }
    } finally {
      setCheckingOutPlayerId(null);
    }
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
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  currentStatus === "active"
                    ? "bg-emerald-500 text-white"
                    : currentStatus === "completed"
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
                }`}
              >
                {currentStatus === "active" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                {currentStatus === "active" ? "Live" : currentStatus === "completed" ? "Finished" : currentStatus === "cancelled" ? "Cancelled" : "Scheduled"}
              </span>
              <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                {sessionMeta.isRanked ? "Ranked" : "Casual"}
              </span>
              <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 first-letter:uppercase">
                {describeRule(sessionMeta)}
              </span>

              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {formatPHTDate(session.start_time)} • {formatPHTTime(session.start_time)} –{" "}
                  {formatPHTTime(session.end_time)}
                </span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {session.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {cleanedDescription || "DCTECH open play rotation on all facility courts."}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
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
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-2xs cursor-pointer select-none"
                  title="Click to view all checked-in players"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">{checkins.length}</span>
                    <span>checked in</span>
                  </span>
                  <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Eye className="h-3 w-3" />
                    <span>View</span>
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>No one checked in yet</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/80">
            {/* Admin Session Lifecycle Controls */}
            {/* Live admin controls live in the console bar below; only Reopen stays here. */}
            {isAdmin && currentStatus === "completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartSession}
                disabled={statusLoading}
                className="w-full md:w-auto text-xs font-mono text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 h-11 sm:h-9 justify-center"
              >
                <span>{statusLoading ? "Reopening..." : "Reopen Session"}</span>
              </Button>
            )}

            {/* Non-Admin Player Check-in / Enter Queue Buttons */}
            {!isSystemAdmin && (
              isCheckedIn ? (
                // Your place in line and break controls live in the queue panel; this is just check-in state.
                <div className="flex items-center justify-between gap-3 w-full md:w-auto">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    You&apos;re checked in
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleCheckOutPlayer(currentUserId!, "yourself")}
                    disabled={checkingOutPlayerId === currentUserId}
                    className="h-11 px-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                    title="Check out and leave the queue"
                  >
                    <UserMinus className="h-4 w-4 mr-1.5" />
                    {checkingOutPlayerId === currentUserId ? "Checking out…" : "Check out"}
                  </Button>
                </div>
              ) : currentStatus === "active" ? (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Button
                    variant={isAdmin ? "outline" : "volt"}
                    size="default"
                    onClick={handleCheckIn}
                    disabled={loading}
                    className="w-full sm:w-auto font-bold text-xs sm:text-sm h-11 sm:h-10 justify-center"
                  >
                    <UserCheck className="h-4 w-4 mr-1.5 shrink-0" />
                    <span>{loading ? "Checking in…" : isAdmin ? "Join as a player" : "Check in & join queue"}</span>
                  </Button>
                </div>
              ) : canRsvp(currentStatus) && currentUserId ? (
                <RsvpButton sessionId={session.id} going={iAmGoing} count={rsvps.length} />
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Who said they're coming */}
      {canRsvp(currentStatus) && (
        <section aria-labelledby="rsvp-heading" className="space-y-2">
          <h2 id="rsvp-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Who&apos;s going ({rsvps.length})
          </h2>
          {rsvps.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No one yet. Tap I&apos;m going to let the organizers know.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {rsvps.map((r) => (
                <li
                  key={r.playerId}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    r.playerId === currentUserId
                      ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {r.name}
                  {r.playerId === currentUserId && " (you)"}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Finish Session Confirmation Modal */}
      <Modal
        isOpen={showFinishConfirm}
        onClose={() => setShowFinishConfirm(false)}
      >
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl cursor-default">
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
                    Games still in progress are not saved. All courts are freed, the queue is cleared, and final standings are shown.
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
      </Modal>

      {/* Final Session Standings Modal Screen */}
      {showFinalStandings && (
        <FinalStandingsModal
          sessionTitle={session.title}
          rankings={initialLeaderboard}
          totalGames={initialMatches.length}
          onClose={() => {
            setShowFinalStandings(false);
            if (isAdmin) {
              router.push("/admin");
            } else {
              router.refresh();
              window.location.reload();
            }
          }}
        />
      )}

      {/* Checked-In Players Pop-Up Modal */}
      <Modal
        isOpen={showCheckedInList}
        onClose={() => setShowCheckedInList(false)}
      >
        <div className="w-full max-w-lg max-h-[85vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl overflow-hidden cursor-default">
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

                        <div className="flex items-center gap-2 shrink-0">
                          {c.player?.skill_rating ? (
                            <Badge variant="outline" className="text-[10px] font-mono font-bold shrink-0">
                              ★ {formatRating(c.player.skill_rating)}
                            </Badge>
                          ) : null}

                          {(isAdmin || isCurrentUser) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={checkingOutPlayerId === (c.player_id || c.player?.id)}
                              onClick={() => handleCheckOutPlayer(c.player_id || c.player?.id, playerName)}
                              className="h-7 px-2 text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:border-rose-300 transition-colors shrink-0 cursor-pointer"
                              title={isCurrentUser ? "Check out of session" : `Check out ${playerName} and remove from queue`}
                            >
                              <UserMinus className="h-3 w-3 mr-1 shrink-0 text-rose-500" />
                              <span>{checkingOutPlayerId === (c.player_id || c.player?.id) ? "Checking out..." : "Check Out"}</span>
                            </Button>
                          )}
                        </div>
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
      </Modal>

      {/* Admin Add / Bulk Queue Modal - Top Level Root Component */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
      >
        <div className="w-full max-w-xl max-h-[90vh] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden cursor-default">
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
      </Modal>

      {isAdmin && (
        <SessionConsoleBar
          session={session}
          status={currentStatus}
          courts={courts || []}
          waitingCount={initialQueue.filter((q) => q.status === "waiting").length}
          checkedInCount={checkins.length}
          autoFill={autoFill}
          onAutoFillChange={setAutoFill}
          onStart={handleStartSession}
          isStarting={statusLoading}
          onAddPlayers={openAddPlayers}
          onEnd={() => setShowFinishConfirm(true)}
        />
      )}

      {/* Main Grid: Court Matrix + Unified Live Queue Link Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <CourtMatrix
            initialCourts={courts}
            userRole={userRole}
            isAdmin={isAdmin && currentStatus === "active"}
            sessionId={session.id}
            queue={initialQueue}
            waitingQueueCount={initialQueue.filter((q) => q.status === "waiting").length}
            targetPoints={sessionMeta.targetPoints}
            autoFill={autoFill}
            winByTwo={sessionMeta.winByTwo}
            trackScores={sessionMeta.trackScores}
          />
        </div>

        {/* Live Queue Station Card */}
        {/* Players care most about their place in line, so on phones it comes before the courts. */}
        <div id="live-queue-station" className={`scroll-mt-20 ${isAdmin ? "" : "order-first lg:order-none"}`}>
          <SessionQueueLiveBoard
            initialQueue={initialQueue}
            sessionId={session.id}
            currentUserId={currentUserId}
            userRole={userRole}
            userEmail={userEmail}
            employees={employees}
            isSessionActive={currentStatus === "active"}
            isSessionScheduled={currentStatus === "scheduled"}
            matchingMode={sessionMeta.matchingMode}
            courts={courts || []}
            history={history}
            skillSpread={sessionMeta.skillSpread}
            onOpenBulkQueue={openAddPlayers}
            activity={{ events, names: activityNames, avgGameMinutes }}
          />
        </div>
      </div>

      <ActivityFeed events={events} names={activityNames} viewerId={currentUserId} />

      {/* Session Leaderboard & Match Logs */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <SessionLeaderboard
          initialRankings={initialLeaderboard}
          matches={initialMatches}
          sessionTitle={session.title}
          isSessionActive={currentStatus === "active"}
          isAdmin={isAdmin}
          rule={{ targetPoints: sessionMeta.targetPoints, winByTwo: sessionMeta.winByTwo, trackScores: sessionMeta.trackScores }}
        />
      </div>
    </div>
  );
}
