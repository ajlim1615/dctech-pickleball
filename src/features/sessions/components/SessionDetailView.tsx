"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Pencil,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { Modal } from "@/components/ui/modal";
import { CourtMatrix } from "@/features/courts/components/CourtMatrix";
import { SessionLeaderboard } from "./SessionLeaderboard";
import { formatPHTDate, formatPHTTime } from "@/lib/timezone";
import { SessionQueueLiveBoard } from "./SessionQueueLiveBoard";
import { FinalStandingsModal } from "./FinalStandingsModal";
import { SessionConsoleBar } from "./SessionConsoleBar";
import { UpNextPanel } from "@/features/queue/components/UpNextPanel";
import { useLiveUpNext } from "@/features/queue/hooks/useLiveUpNext";
import { RsvpButton } from "./RsvpButton";
import { canRsvp } from "@/features/sessions/utils/rsvp";
import {
  checkInToSession,
  checkOutOfSession,
  updateSessionStatus,
  type SessionRankedPlayer,
} from "../api/sessionActions";
import { bulkAddPlayersToQueue } from "@/features/queue/api/queueActions";
import { NO_LIMITS_USED, leaveIsFinal, type QueueLimits } from "@/features/queue/utils/queueLimits";
import { createWalkInPlayer, updateSessionCourtCount, updateSessionDetails } from "@/features/admin/api/adminActions";
import { isGuestProfile } from "@/features/admin/utils/playerDirectory";
import { applySessionCourtNames, formatRating, parseSessionMetadata } from "@/lib/utils";
import type { Session, ActiveCourtView, QueueEntryWithPlayer, Profile, SessionEvent, Venue } from "@/types";
import { VenueLocationLink } from "@/features/venues/components/VenueLocationLink";
import { gamesPlayedCounts, type PastGame } from "@/features/queue/matchmaking";
import { arrivalsFromCheckins } from "@/features/queue/api/matchmakingData";
import { useLiveFeed } from "@/features/activity/hooks/useLiveFeed";
import { ActivityFeed } from "@/features/activity/components/ActivityFeed";
import type { MatchTeams } from "@/features/activity/utils/describeEvent";
import { describeRule } from "@/features/matches/utils/scoring";
import { DEFAULT_COURT_COUNT } from "@/lib/constants";
import { previewCourts } from "@/features/sessions/utils/previewCourts";
import { CourtCapacityStrip } from "./CourtCapacityStrip";
import { WhosGoing, type GoingPlayer } from "./WhosGoing";

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
  /** Open the start dialog ("Who's here?") on load. */
  openStart?: boolean;
  /** People who said they're going (upcoming sessions). */
  rsvps?: GoingPlayer[];
  /** Session activity, newest first, and the average game length so far. */
  initialEvents?: SessionEvent[];
  avgGameMinutes?: number | null;
  /** Finished games, for the Up next preview. */
  history?: PastGame[];
  /** Breaks and leaves the signed-in player used this session (one break, one rejoin). */
  queueLimits?: QueueLimits;
  venues?: Venue[];
}

const NO_RSVPS: GoingPlayer[] = [];
const NO_EVENTS: SessionEvent[] = [];
const NO_VENUES: Venue[] = [];

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
  queueLimits = NO_LIMITS_USED,
  venues = NO_VENUES,
  openStart = false,
}: SessionDetailViewProps) {
  const events = useLiveFeed(session.id, initialEvents);
  // Names & avatars for the activity feed: everyone the page knows about.
  const { activityNames, activityAvatars } = useMemo(() => {
    const namesMap: Record<string, string> = {};
    const avatarsMap: Record<string, string | null> = {};
    const add = (p?: { id?: string; full_name?: string | null; display_name?: string | null; avatar_url?: string | null } | null) => {
      if (!p?.id) return;
      namesMap[p.id] = p.full_name || p.display_name || namesMap[p.id] || "A player";
      if (p.avatar_url) avatarsMap[p.id] = p.avatar_url;
      else if (!(p.id in avatarsMap)) avatarsMap[p.id] = null;
    };
    employees.forEach(add);
    (session.checkins || []).forEach((c: { player?: Profile }) => add(c.player));
    initialQueue.forEach((q) => add(q.player));
    (courts || []).forEach((c) => c.current_match?.players?.forEach((p) => add(p.profile)));
    (initialMatches || []).forEach((m: { players?: { player?: Profile | null }[] }) =>
      m.players?.forEach((p) => add(p.player))
    );
    return { activityNames: namesMap, activityAvatars: avatarsMap };
  }, [employees, session.checkins, initialQueue, courts, initialMatches]);

  const activityMatchCourtNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of events) {
      const d = (e.details ?? {}) as Record<string, unknown>;
      if (e.match_id && !map[e.match_id] && typeof d.courtName === "string" && d.courtName) {
        map[e.match_id] = d.courtName;
      }
    }
    return map;
  }, [events]);

  const activityMatchTeams = useMemo(() => {
    const map: Record<string, MatchTeams> = {};
    const ordered = (initialMatches || [])
      .filter((m) => m?.id && m.status !== "cancelled" && m.status !== "abandoned")
      .sort((a, b) => {
        const ta = a.started_at || a.created_at || "";
        const tb = b.started_at || b.created_at || "";
        return ta < tb ? -1 : ta > tb ? 1 : String(a.id).localeCompare(String(b.id));
      });
    ordered.forEach((m, idx) => {
      const teamA: string[] = [];
      const teamB: string[] = [];
      for (const p of Array.isArray(m.players) ? m.players : []) {
        const pid = p.player_id ?? p.player?.id;
        if (!pid) continue;
        (p.team === "team_a" ? teamA : teamB).push(pid);
      }
      map[m.id] = { teamA, teamB, gameNumber: idx + 1 };
    });
    return map;
  }, [initialMatches]);
  const iAmGoing = Boolean(currentUserId && rsvps.some((r) => r.playerId === currentUserId));
  const router = useRouter();
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = userRole === "admin" || isSystemAdmin;

  const [activeCheckins, setActiveCheckins] = useState<any[]>(session.checkins || []);
  const [checkingOutPlayerId, setCheckingOutPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setActiveCheckins(session.checkins || []);
  }, [session.checkins]);

  const arrivedAtByPlayer = useMemo(
    () => arrivalsFromCheckins(activeCheckins),
    [activeCheckins]
  );

  const gamesPlayed = useMemo(() => {
    const counts = gamesPlayedCounts(history ?? []);
    return Object.fromEntries(counts);
  }, [history]);

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
  // The admin dashboard's Start lands here with ?start=1 to pick who's here.
  const [showStartConfirm, setShowStartConfirm] = useState(
    Boolean(openStart && isAdmin && session.status === "scheduled")
  );
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
  const sessionMeta = useMemo(() => parseSessionMetadata(session.description), [session.description]);
  const activityCourtNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of applySessionCourtNames(courts || [], sessionMeta.courtNames)) {
      if (c.id) map[c.id] = c.name;
    }
    // Preserve names of courts that were later removed from the facility list.
    for (const e of events) {
      const d = (e.details ?? {}) as Record<string, unknown>;
      if (e.court_id && !map[e.court_id] && typeof d.courtName === "string" && d.courtName) {
        map[e.court_id] = d.courtName;
      }
    }
    return map;
  }, [courts, sessionMeta.courtNames, events]);
  const [walkInIsGuest, setWalkInIsGuest] = useState(!sessionMeta.isRanked);
  const [walkInAutoQueue, setWalkInAutoQueue] = useState(true);
  const [isCreatingWalkIn, setIsCreatingWalkIn] = useState(false);
  // Blocks a second submit of Queue Selected / Create walk-in before the button greys out.
  const submitLock = useRef(false);
  const [displayTitle, setDisplayTitle] = useState(session.title);
  const [displayDescription, setDisplayDescription] = useState(sessionMeta.cleanDescription);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [draftTitle, setDraftTitle] = useState(session.title);
  const [draftDescription, setDraftDescription] = useState(sessionMeta.cleanDescription);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [displayCourtCount, setDisplayCourtCount] = useState<number>(
    currentStatus === "active"
      ? courts?.length || (sessionMeta.courtCount ?? DEFAULT_COURT_COUNT)
      : (sessionMeta.courtCount ?? DEFAULT_COURT_COUNT)
  );
  const [pendingCourtCount, setPendingCourtCount] = useState<number | null>(null);
  const [savingCourtCount, setSavingCourtCount] = useState(false);
  const [courtCountError, setCourtCountError] = useState<string | null>(null);
  const [newCourtName, setNewCourtName] = useState("");

  useEffect(() => {
    setDisplayCourtCount(
      currentStatus === "active"
        ? courts?.length || (sessionMeta.courtCount ?? DEFAULT_COURT_COUNT)
        : (sessionMeta.courtCount ?? DEFAULT_COURT_COUNT)
    );
  }, [currentStatus, courts?.length, sessionMeta.courtCount]);

  async function handleConfirmCourtCount() {
    if (!isAdmin || pendingCourtCount === null || savingCourtCount) return;
    const name = newCourtName.trim();
    if (!name) {
      setCourtCountError("Court name is required.");
      return;
    }
    setSavingCourtCount(true);
    setCourtCountError(null);
    const res = await updateSessionCourtCount(session.id, pendingCourtCount, name);
    setSavingCourtCount(false);
    if (res?.error) {
      setCourtCountError(res.error);
      return;
    }
    setDisplayCourtCount(res?.courtCount ?? pendingCourtCount);
    setPendingCourtCount(null);
  }

  function openEditDetails() {
    setDraftTitle(displayTitle);
    setDraftDescription(displayDescription);
    setDetailsError(null);
    setIsEditingDetails(true);
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || savingDetails) return;
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      setDetailsError("Session name is required.");
      return;
    }
    setSavingDetails(true);
    setDetailsError(null);
    const res = await updateSessionDetails(session.id, trimmedTitle, draftDescription);
    setSavingDetails(false);
    if (res?.error) {
      setDetailsError(res.error);
      return;
    }
    setDisplayTitle(res?.title ?? trimmedTitle);
    setDisplayDescription(res?.description ?? draftDescription.trim());
    setIsEditingDetails(false);
  }
  // Live: the arena's real courts. Otherwise: this session's own court count, since the
  // shared arena only switches to it when the session starts.
  const shownCourts = useMemo(
    () =>
      currentStatus === "active"
        ? courts || []
        : previewCourts(courts || [], displayCourtCount),
    [currentStatus, courts, displayCourtCount]
  );

  // One live Up Next subscription per session page, shared by Courts and Up Next.
  const upNextCards = useLiveUpNext(currentStatus === "active" ? session.id : undefined);

  function openAddPlayers() {
    setSelectedPlayerIds([]);
    setBulkSearch("");
    setModalTab("roster");
    setWalkInIsGuest(!sessionMeta.isRanked);
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
    // Deactivated accounts can't play, so they never show in the pickers.
    return employees.filter(
      (e) =>
        e.is_active !== false &&
        e.email?.toLowerCase() !== "admin@dctechmicro.com" &&
        (!sessionMeta.isRanked || !isGuestProfile(e))
    );
  }, [employees, sessionMeta.isRanked]);

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
    if (!session.id || selectedPlayerIds.length === 0 || submitLock.current) return;
    submitLock.current = true;
    setIsBulkAdding(true);
    try {
      const res = await bulkAddPlayersToQueue(session.id, selectedPlayerIds);
      if (res?.error) {
        alert(`Error queueing players: ${res.error}`);
      } else {
        setSelectedPlayerIds([]);
        setShowBulkModal(false);
      }
    } finally {
      submitLock.current = false;
      setIsBulkAdding(false);
    }
  }

  async function handleCreateWalkIn(e: React.FormEvent) {
    e.preventDefault();
    // A double tap (or Enter twice) would otherwise register the same walk-in twice.
    if (!walkInName.trim() || submitLock.current) return;
    submitLock.current = true;
    setIsCreatingWalkIn(true);
    try {
      const isGuestWalkIn = !sessionMeta.isRanked && walkInIsGuest;
      const res = await createWalkInPlayer({
        fullName: walkInName.trim(),
        email: !isGuestWalkIn && walkInEmail.trim() ? walkInEmail.trim() : undefined,
        isGuest: isGuestWalkIn,
        skillRating: walkInRating,
        sessionId: session.id,
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
      }
    } finally {
      submitLock.current = false;
      setIsCreatingWalkIn(false);
    }
  }

  // "Who's here?" at the start: only ticked players go into the line. Nobody is
  // ticked to begin with; people who arrive later check in or get added.
  const [hereIds, setHereIds] = useState<string[]>([]);
  const [hereSearch, setHereSearch] = useState("");
  const isFirstStart = currentStatus === "scheduled";
  const hereChoices = useMemo(() => {
    const q = hereSearch.trim().toLowerCase();
    const sorted = rsvps.toSorted((a, b) => a.name.localeCompare(b.name));
    return q ? sorted.filter((r) => r.name.toLowerCase().includes(q)) : sorted;
  }, [rsvps, hereSearch]);

  function openStartConfirm() {
    setHereIds([]);
    setHereSearch("");
    setShowStartConfirm(true);
  }

  // Drop ?start=1 once used, so a refresh doesn't reopen the picker.
  useEffect(() => {
    if (!openStart) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("start");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, [openStart]);

  function toggleHere(playerId: string) {
    setHereIds((prev) => (prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]));
  }

  async function handleStartSession() {
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      const res = await updateSessionStatus(session.id, "active", isFirstStart ? { hereIds } : {});
      if (res?.error) {
        alert(`Error starting session: ${res.error}`);
      } else {
        if ("warning" in res && res.warning) alert(res.warning);
        setCurrentStatus("active");
      }
    } finally {
      setStatusLoading(false);
      setShowStartConfirm(false);
    }
  }

  async function handleCheckIn() {
    if (isSystemAdmin || loading) return;
    setLoading(true);
    try {
      const res = await checkInToSession(session.id);
      if (!res?.error) {
        setIsCheckedIn(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOutPlayer(targetPlayerId: string, playerName: string) {
    if (checkingOutPlayerId || !targetPlayerId) return;
    const isSelf = targetPlayerId === currentUserId;
    const confirmMessage = isSelf
      ? leaveIsFinal(queueLimits)
        ? "Check out for good? You already left once, so you won't be able to check back in yourself. An admin can add you back."
        : "Check out of this session? You'll be taken out of the line. You can check back in once, at the back of the line."
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
      }
    } finally {
      setCheckingOutPlayerId(null);
    }
  }


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

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 sm:p-6 backdrop-blur-md shadow-sm overflow-hidden space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 sm:gap-6">
          <div className="space-y-2 min-w-0">
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
              {currentStatus === "active" && (
                <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {courts?.length || 0} {courts?.length === 1 ? "court" : "courts"}
                </span>
              )}
            </div>

            {isEditingDetails ? (
              <form onSubmit={handleSaveDetails} className="space-y-3 max-w-xl">
                <div>
                  <label htmlFor="session-title-input" className="sr-only">
                    Session name
                  </label>
                  <input
                    id="session-title-input"
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    disabled={savingDetails}
                    autoFocus
                    maxLength={120}
                    placeholder="Session name"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="session-description-input" className="sr-only">
                    Session description
                  </label>
                  <textarea
                    id="session-description-input"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    disabled={savingDetails}
                    rows={2}
                    maxLength={500}
                    placeholder="Session description or notes (optional)"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                  />
                </div>
                {detailsError && (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {detailsError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" disabled={savingDetails} className="cursor-pointer">
                    <Check className="h-3.5 w-3.5" />
                    {savingDetails ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingDetails(false)}
                    disabled={savingDetails}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-2.5">
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {displayTitle}
                </h1>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openEditDetails}
                    title="Edit session name and description"
                    aria-label="Edit session name and description"
                    className="mt-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                )}
              </div>
            )}

            {/* When and where: what people check first */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {formatPHTDate(session.start_time)}, {formatPHTTime(session.start_time)} –{" "}
                  {formatPHTTime(session.end_time)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <VenueLocationLink
                  location={session.location}
                  venueId={session.venue_id}
                  venues={venues}
                />
              </span>
            </div>

            {!isEditingDetails && displayDescription && (
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">{displayDescription}</p>
            )}

            {/* Check-ins only exist once the session is live */}
            {currentStatus !== "scheduled" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
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
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/80">
            {/* Admin Session Lifecycle Controls */}
            {/* Live admin controls live in the console bar below; only Reopen stays here. */}
            {isAdmin && currentStatus === "completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStartConfirm(true)}
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

          {/* How busy it will be: the session's courts filling up with everyone going */}
          {canRsvp(currentStatus) && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <CourtCapacityStrip courts={sessionMeta.courtCount ?? DEFAULT_COURT_COUNT} going={rsvps.length} />
            </div>
          )}
        </div>
      </div>

      {/* Who said they're coming */}
      {canRsvp(currentStatus) && (
        <WhosGoing
          rsvps={rsvps}
          currentUserId={currentUserId}
          sessionId={session.id}
          isAdmin={isAdmin}
          isRanked={sessionMeta.isRanked}
          availablePlayers={
            isAdmin
              ? eligibleEmployees
                  .filter((e) => !rsvps.some((r) => r.playerId === e.id))
                  .map((e) => ({
                    playerId: e.id,
                    name: e.full_name || e.display_name || e.email || "Player",
                    avatarUrl: e.avatar_url || null,
                  }))
                  .sort((a, b) => a.name.localeCompare(b.name))
              : undefined
          }
        />
      )}

      {/* Start / Reopen Session Confirmation Modal */}
      <Modal isOpen={showStartConfirm} onClose={() => !statusLoading && setShowStartConfirm(false)}>
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl cursor-default">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <PlayCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {currentStatus === "completed" ? `Reopen ${session.title}?` : `Start ${session.title}?`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentStatus === "completed"
                    ? "The session goes live again, so players can rejoin the line and games can be recorded."
                    : rsvps.length > 0
                      ? "Tick who's at the courts. Only they are shuffled into the line; the rest join when they arrive. \"I'm going\" closes and any other live session is ended."
                      : "Courts open for games and \"I'm going\" closes. Add players once it's live. Any other live session is ended."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowStartConfirm(false)}
              disabled={statusLoading}
              aria-label="Close"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isFirstStart && rsvps.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Who&apos;s here?{" "}
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {hereIds.length}/{rsvps.length}
                  </span>
                </p>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setHereIds(rsvps.map((r) => r.playerId))}
                    disabled={statusLoading}
                    className="rounded-lg px-2 py-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                  >
                    All here
                  </button>
                  <button
                    type="button"
                    onClick={() => setHereIds([])}
                    disabled={statusLoading || hereIds.length === 0}
                    className="rounded-lg px-2 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {rsvps.length > 8 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={hereSearch}
                    onChange={(e) => setHereSearch(e.target.value)}
                    placeholder="Find a player…"
                    aria-label="Find a player"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              )}
              <ul className="max-h-72 overflow-y-auto grid grid-cols-1 min-[420px]:grid-cols-2 gap-1.5 pr-1">
                {hereChoices.map((r) => {
                  const here = hereIds.includes(r.playerId);
                  return (
                    <li key={r.playerId}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={here}
                        onClick={() => toggleHere(r.playerId)}
                        disabled={statusLoading}
                        className={`w-full flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm transition-colors cursor-pointer ${
                          here
                            ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <span
                          className={`h-4 w-4 shrink-0 rounded flex items-center justify-center border ${
                            here ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {here && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{r.name}</span>
                      </button>
                    </li>
                  );
                })}
                {hereChoices.length === 0 && (
                  <li className="col-span-full py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                    No one going matches that name.
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowStartConfirm(false)}
              disabled={statusLoading}
              className="font-semibold text-xs"
            >
              Not yet
            </Button>
            <Button
              type="button"
              variant="volt"
              onClick={handleStartSession}
              disabled={statusLoading}
              className="font-bold text-xs cursor-pointer"
            >
              {statusLoading
                ? currentStatus === "completed" ? "Reopening…" : "Starting…"
                : currentStatus === "completed"
                  ? "Yes, reopen"
                  : isFirstStart && rsvps.length > 0
                    ? hereIds.length > 0
                      ? `Start with ${hereIds.length} ${hereIds.length === 1 ? "player" : "players"}`
                      : "Start with empty line"
                    : "Yes, start session"}
            </Button>
          </div>
        </div>
      </Modal>

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
                // One column: the dialog is too narrow for name + rating + Check Out twice side by side.
                <div className="grid grid-cols-1 gap-2">
                  {filteredCheckins.map((c, i) => {
                    const playerName = c.player?.full_name || c.player?.display_name || "Employee";
                    const isCurrentUser = currentUserId && (c.player_id === currentUserId || c.player?.id === currentUserId);

                    return (
                      <div
                        key={c.id || i}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border transition-all ${
                          isCurrentUser
                            ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-xs"
                            : "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex flex-1 items-center gap-2.5 min-w-0">
                          <PlayerAvatar name={playerName} avatarUrl={c.player?.avatar_url} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 min-w-0">
                              <span className="truncate" title={playerName}>{playerName}</span>
                              {isCurrentUser && (
                                <Badge variant="volt" className="shrink-0 text-[9px] font-mono py-0 px-1">
                                  YOU
                                </Badge>
                              )}
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

                            <PlayerAvatar name={playerName} avatarUrl={emp.avatar_url} size="md" />

                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {playerName}
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
                  {sessionMeta.isRanked ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Ranked session:</span>{" "}
                      Only DCTECH employees can be added. Non-employee guests can only be added in Casual sessions.
                    </div>
                  ) : (
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
                            <span>🏷️ Guest / Non-Employee</span>
                          </div>
                          <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                            No login · queue only
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
                  )}

                  {/* Optional Work Email for Internal Coworkers */}
                  {(sessionMeta.isRanked || !walkInIsGuest) && (
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
                        Syncs match history and rating automatically when they log in with this email.
                      </p>
                    </div>
                  )}

                  {/* Skill Rating / DUPR Level */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Starting skill rating
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
          courts={shownCourts}
          waitingCount={initialQueue.filter((q) => q.status === "waiting").length}
          checkedInCount={checkins.length}
          onStart={openStartConfirm}
          isStarting={statusLoading}
          onAddPlayers={openAddPlayers}
          onEnd={() => setShowFinishConfirm(true)}
        />
      )}

      {/* Main Grid: Court Matrix + Unified Live Queue Link Card (only for active/scheduled sessions) */}
      {(currentStatus === "active" || currentStatus === "scheduled") && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {isAdmin && (currentStatus === "active" || currentStatus === "scheduled") && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 px-4 py-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Courts
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                  {displayCourtCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {currentStatus === "scheduled"
                    ? "Applies when session starts"
                    : "Live arena courts"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={displayCourtCount >= 12 || savingCourtCount}
                  onClick={() => {
                    setCourtCountError(null);
                    setNewCourtName("");
                    setPendingCourtCount(displayCourtCount + 1);
                  }}
                  aria-label="Add a court"
                  className="h-8 px-2.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs">Add court</span>
                </Button>
              </div>
            </div>
          )}
          <CourtMatrix
            initialCourts={shownCourts}
            userRole={userRole}
            isAdmin={isAdmin && currentStatus === "active"}
            allowCourtRename={isAdmin && (currentStatus === "active" || currentStatus === "scheduled")}
            syncArenaList={currentStatus === "active"}
            sessionId={session.id}
            queue={initialQueue}
            cards={upNextCards}
            waitingQueueCount={initialQueue.filter((q) => q.status === "waiting").length}
            targetPoints={sessionMeta.targetPoints}
            winByTwo={sessionMeta.winByTwo}
            trackScores={sessionMeta.trackScores}
            courtNames={sessionMeta.courtNames}
            gamesPlayed={gamesPlayed}
          />
          {currentStatus === "active" && (
            <div className="mt-6">
              <UpNextPanel
                sessionId={session.id}
                courts={shownCourts}
                queue={initialQueue}
                cards={upNextCards}
                isAdmin={isAdmin}
                gamesPlayed={gamesPlayed}
              />
            </div>
          )}
        </div>

        <Modal
          isOpen={pendingCourtCount !== null}
          onClose={() => {
            if (!savingCourtCount) {
              setPendingCourtCount(null);
              setCourtCountError(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl cursor-default">
            <form
              id="add-court-form"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirmCourtCount();
              }}
            >
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Add a court</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {currentStatus === "active"
                    ? `It joins the live arena right away (total: ${pendingCourtCount ?? displayCourtCount + 1} courts).`
                    : `It's added to this scheduled session (total: ${pendingCourtCount ?? displayCourtCount + 1} courts).`}
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Court name</span>
                <input
                  type="text"
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  placeholder={`e.g. Court ${pendingCourtCount ?? displayCourtCount + 1}`}
                  maxLength={40}
                  autoFocus
                  disabled={savingCourtCount}
                  className="h-11 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
            </form>
            {courtCountError && (
              <p role="alert" className="rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {courtCountError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingCourtCount(null);
                  setCourtCountError(null);
                }}
                disabled={savingCourtCount}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="add-court-form"
                disabled={savingCourtCount || !newCourtName.trim()}
                className="cursor-pointer"
              >
                {savingCourtCount ? "Adding…" : "Add court"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Live Queue Station Card */}
        {/* Players care most about their place in line, so on phones it comes before the courts. */}
        <div id="live-queue-station" className={`scroll-mt-20 ${isAdmin ? "" : "order-first lg:order-none"}`}>
          <SessionQueueLiveBoard
            initialQueue={initialQueue}
            sessionId={session.id}
            currentUserId={currentUserId}
            userRole={userRole}
            userEmail={userEmail}
            employees={eligibleEmployees}
            isSessionActive={currentStatus === "active"}
            isSessionScheduled={currentStatus === "scheduled"}
            matchingMode={sessionMeta.matchingMode}
            courts={shownCourts}
            history={history}
            skillSpread={sessionMeta.skillSpread}
            allowPartners={sessionMeta.allowPartners}
            queueLimits={queueLimits}
            onOpenBulkQueue={openAddPlayers}
            activity={{ events, names: activityNames, avgGameMinutes }}
            gamesPlayed={gamesPlayed}
            arrivedAtByPlayer={arrivedAtByPlayer}
            onCheckOut={
              currentUserId && isCheckedIn
                ? () => handleCheckOutPlayer(currentUserId, "yourself")
                : undefined
            }
            checkingOut={checkingOutPlayerId === currentUserId}
          />
        </div>
      </div>
      )}

      {/* Session Leaderboard, Match Logs & Activity */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <SessionLeaderboard
          initialRankings={initialLeaderboard}
          matches={initialMatches}
          sessionTitle={session.title}
          isSessionActive={currentStatus === "active"}
          isAdmin={isAdmin}
          sessionId={session.id}
          courtNames={activityCourtNames}
          matchCourtNames={activityMatchCourtNames}
          rule={{ targetPoints: sessionMeta.targetPoints, winByTwo: sessionMeta.winByTwo, trackScores: sessionMeta.trackScores }}
          activityCount={currentStatus === "scheduled" ? 0 : events.length}
          activityFeed={
            <ActivityFeed
              events={events}
              names={activityNames}
              avatars={activityAvatars}
              viewerId={currentUserId}
              sessionStatus={currentStatus}
              matchTeams={activityMatchTeams}
              courtNames={activityCourtNames}
            />
          }
        />
      </div>
    </div>
  );
}
