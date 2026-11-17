"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RATING_RULES } from "@/features/rankings/ratingConfig";
import {
  Calendar,
  Users,
  Plus,
  Check,
  Activity,
  UserPlus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Pencil,
  ExternalLink,
  AlertTriangle,
  History,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PRIMARY_MATCHING_STYLES,
  ADMIN_MORE_MATCHING_STYLES,
  ADMIN_SELECT_MATCHING_STYLES,
} from "@/features/queue/constants/matchingStyles";
import { Modal } from "@/components/ui/modal";
import { PlayerPhotoViewer, type PhotoTarget } from "@/features/players/components/PlayerPhotoViewer";
import { PlayerDirectory } from "./PlayerDirectory";
import { AdminRulesGuide } from "./AdminRulesGuide";
import { RATING_PRESETS, ratingLevel } from "../utils/playerDirectory";
import { DEFAULT_COURT_COUNT } from "@/lib/constants";
import { CourtStatusIndicator } from "@/components/layout/CourtStatusIndicator";
import {
  toggleCourtStatus,
  updatePlayerRole,
  adjustPlayerRating,
  resetPlayerPassword,
  resetSessionQueue,
  assignStaffToCourt,
  setRentedCourtCount,
  createWalkInPlayer,
  updatePlayerDetails,
  togglePlayerActiveStatus,
  cancelSession,
  editSession,
} from "../api/adminActions";
import { createSession, updateSessionStatus } from "@/features/sessions/api/sessionActions";
import { cleanSessionDescription, formatRating, parseSessionMetadata } from "@/lib/utils";
import { DEFAULT_SKILL_SPREAD } from "@/features/queue/matchmaking";
import {
  formatPHTDate,
  formatPHTTime,
  toPHTDateTimeLocal,
  getPHTTodayString,
} from "@/lib/timezone";
import type { CourtStatus, UserRole, Profile, Session, ActiveCourtView, Venue } from "@/types";
import { SessionRow, SessionRuleChips } from "@/features/sessions/components/SessionRow";
import { AdminAuditView } from "@/features/activity/components/AdminAuditView";
import { AdminVenuesSection } from "@/features/venues/components/AdminVenuesSection";
import { VenuePicker } from "@/features/venues/components/VenuePicker";

interface AdminDashboardProps {
  initialEmployees?: Profile[];
  initialSessions?: Session[];
  initialCourts?: ActiveCourtView[];
  initialVenues?: Venue[];
  /** RSVP head count per upcoming session. */
  rsvpCounts?: Record<string, number>;
  /** Signed in as admin@dctechmicro.com: the only account that can change a player's rating, name, photo or role, or reset a password. */
  isSystemAdmin?: boolean;
}

export function AdminDashboard({
  initialEmployees = [],
  initialSessions = [],
  initialCourts = [],
  initialVenues = [],
  rsvpCounts = {},
  isSystemAdmin: viewerIsSystemAdmin = false,
}: AdminDashboardProps) {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [activeTab, setActiveTab] = useState<"sessions" | "players" | "guide" | "activity">("sessions");
  const [notification, setNotification] = useState<string | null>(null);

  // Fast-Add Walk In State
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInType, setWalkInType] = useState<"guest" | "employee">("guest");
  const [walkInRating, setWalkInRating] = useState<number>(3.0);

  // Edit Player Details State (Name & Email)
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerEmail, setEditPlayerEmail] = useState("");
  const [isUpdatingPlayer, setIsUpdatingPlayer] = useState(false);

  // Player Tier Category Filter State (Combobox)
  // Change-rating dialog (System Admin)
  const [ratingTarget, setRatingTarget] = useState<Profile | null>(null);
  const [ratingDraft, setRatingDraft] = useState("");
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [isSavingRating, setIsSavingRating] = useState(false);

  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [isEditingSession, setIsEditingSession] = useState<Session | null>(null);
  const [isSubmittingEditSession, setIsSubmittingEditSession] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isConfirmModalSubmitting, setIsConfirmModalSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isScalingCourts, setIsScalingCourts] = useState(false);
  const [isExportingRoster, setIsExportingRoster] = useState(false);

  // Clean confirmation modal state (replaces raw window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    action: () => Promise<void>;
  } | null>(null);

  // Session Creation Config State
  const [selectedMatchingMode, setSelectedMatchingMode] = useState<string>("balanced");
  const [sessionIsRanked, setSessionIsRanked] = useState<boolean>(true);
  const [sessionTargetPoints, setSessionTargetPoints] = useState<number>(11);
  const [sessionWinByTwo, setSessionWinByTwo] = useState<boolean>(true);
  const [sessionTrackScores, setSessionTrackScores] = useState<boolean>(true);
  const [sessionAllowPartners, setSessionAllowPartners] = useState<boolean>(false);
  const [editAllowPartners, setEditAllowPartners] = useState<boolean>(false);
  const [showMoreMatchingModes, setShowMoreMatchingModes] = useState<boolean>(false);

  // Session Edit Config State
  const [editMatchingMode, setEditMatchingMode] = useState<string>("balanced");
  const [createSkillSpread, setCreateSkillSpread] = useState<string>(String(DEFAULT_SKILL_SPREAD));
  const [editSkillSpread, setEditSkillSpread] = useState<string>(String(DEFAULT_SKILL_SPREAD));
  const [editIsRanked, setEditIsRanked] = useState<boolean>(true);
  const [editTargetPoints, setEditTargetPoints] = useState<number>(11);
  const [editWinByTwo, setEditWinByTwo] = useState<boolean>(true);
  const [editTrackScores, setEditTrackScores] = useState<boolean>(true);

  const [courts, setCourts] = useState<
    { id: string; name: string; status: CourtStatus; surface: string; assignedStaffId?: string | null }[]
  >(
    initialCourts.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      surface: c.surface_type || "Standard Court",
      assignedStaffId: (c as any).assigned_staff_id || null,
    }))
  );

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const activeSession = sessions.find((s) => s.status === "active");
  const [employees, setEmployees] = useState<Profile[]>(initialEmployees);
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null);

  // Sync edit modal state when an existing session is selected
  useEffect(() => {
    if (isEditingSession) {
      const meta = parseSessionMetadata(isEditingSession.description);
      setEditMatchingMode(meta.matchingMode);
      setEditIsRanked(meta.isRanked);
      setEditTargetPoints(meta.targetPoints);
      setEditWinByTwo(meta.winByTwo);
      setEditTrackScores(meta.trackScores);
      setEditSkillSpread(String(meta.skillSpread));
      setEditAllowPartners(meta.allowPartners);
    }
  }, [isEditingSession]);

  function getStarSkillInfo(rating?: number | null) {
    const r = Number(rating || 0);
    if (r <= 0) return { stars: 0, label: "Set skill", dupr: 2.0 };
    if (r < 2.25) return { stars: 1, label: "Beginner (2.0)", dupr: 2.0 };
    if (r < 2.75) return { stars: 2, label: "Adv. Beginner (2.5)", dupr: 2.5 };
    if (r < 3.25) return { stars: 3, label: "Intermediate (3.0)", dupr: 3.0 };
    if (r < 3.75) return { stars: 4, label: "Adv. Intermediate (3.5)", dupr: 3.5 };
    if (r < 4.25) return { stars: 5, label: "Advanced (4.0)", dupr: 4.0 };
    return { stars: 6, label: "Expert (4.5+)", dupr: 4.5 };
  }

  useEffect(() => {
    setCourts(
      initialCourts.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        surface: c.surface_type || "Standard Court",
        assignedStaffId: (c as any).assigned_staff_id || null,
      }))
    );
  }, [initialCourts]);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  async function handleToggleStatus(courtId: string, newStatus: CourtStatus) {
    setCourts((prev) =>
      prev.map((c) => (c.id === courtId ? { ...c, status: newStatus } : c))
    );
    await toggleCourtStatus(courtId, newStatus);
    showNotice(`Court ${courtId} status set to ${newStatus.toUpperCase()}`);
  }

  const playerName = (p?: Profile) => p?.full_name || p?.display_name || "this player";

  /** System Admin only. Asks first: making someone an admin gives them the whole admin panel. */
  function handleRoleChange(userId: string, newRole: UserRole) {
    const emp = employees.find((e) => e.id === userId);
    if (!emp || emp.role === newRole) return;
    const name = playerName(emp);
    const promoting = newRole === "admin";
    setConfirmModal({
      isOpen: true,
      title: promoting ? `Make ${name} an admin?` : `Make ${name} a player?`,
      message: promoting
        ? `${name} will be able to run sessions, score games and manage the line. Only the System Admin can change ratings, names, photos and roles.`
        : `${name} will lose access to the Admin panel and go back to being a player.`,
      confirmLabel: promoting ? "Make admin" : "Make player",
      isDestructive: !promoting,
      action: async () => {
        const res = await updatePlayerRole(userId, newRole);
        if (res?.error) {
          showNotice(`Error: ${res.error}`);
          return;
        }
        setEmployees((prev) => prev.map((e) => (e.id === userId ? { ...e, role: newRole } : e)));
        showNotice(`${name} is now ${promoting ? "an admin" : "a player"}.`);
      },
    });
  }

  /** System Admin only. The dialog is the confirmation; the table changes once the server agrees. */
  async function saveRating() {
    if (!ratingTarget) return;
    const value = Number(ratingDraft);
    if (ratingDraft.trim() === "" || !Number.isFinite(value) || value < RATING_RULES.min || value > RATING_RULES.max) {
      setRatingError(`Enter a rating from ${RATING_RULES.min.toFixed(2)} to ${RATING_RULES.max.toFixed(2)}.`);
      return;
    }
    const rounded = Math.round(value * 100) / 100;
    const target = ratingTarget;
    if (rounded === Number(target.skill_rating)) {
      setRatingTarget(null);
      return;
    }
    setIsSavingRating(true);
    const res = await adjustPlayerRating(target.id, rounded);
    setIsSavingRating(false);
    if (res?.error) {
      setRatingError(res.error);
      return;
    }
    setEmployees((prev) => prev.map((e) => (e.id === target.id ? { ...e, skill_rating: rounded } : e)));
    setRatingTarget(null);
    showNotice(`${playerName(target)}'s rating is now ${formatRating(rounded)}.`);
  }

  /** Any admin can switch an account on or off (it can be switched back any time). */
  async function toggleActive(emp: Profile) {
    const name = playerName(emp);
    const nextState = !emp.is_active;
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, is_active: nextState } : e)));
    const res = await togglePlayerActiveStatus(emp.id, nextState);
    if (res?.error) {
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, is_active: !nextState } : e)));
      showNotice(`Error: ${res.error}`);
    } else {
      showNotice(`${name}'s account is now ${nextState ? "on" : "off"}.`);
    }
  }

  /** System Admin only. Puts the shared starting password back; they set a new one on next sign-in. */
  function handleResetPassword(emp: Profile) {
    const name = playerName(emp);
    setConfirmModal({
      isOpen: true,
      title: `Reset ${name}'s password?`,
      message: `Their password goes back to the starting password shown on the sign-in page. They'll have to choose a new password the next time they sign in. Tell ${name} directly; no email is sent.`,
      confirmLabel: "Reset password",
      isDestructive: true,
      action: async () => {
        const res = await resetPlayerPassword(emp.id);
        if (res?.error) {
          showNotice(`Error: ${res.error}`);
          return;
        }
        showNotice(`${name}'s password was reset. They'll set a new one when they sign in.`);
      },
    });
  }

  async function handleCreateSessionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingSession) return;
    setIsSubmittingSession(true);
    try {
      const formData = new FormData(e.currentTarget);
      const countStr = (formData.get("courtCount") as string) || "4";
      const courtCount = parseInt(countStr, 10) || 4;

      const res = await createSession(formData);
      if (res?.error) {
        showNotice(`Error: ${res.error}`);
      } else {
        setIsCreatingSession(false);
        showNotice(`Session created and ${courtCount} rented courts provisioned!`);
      }
    } finally {
      setIsSubmittingSession(false);
    }
  }

  async function handleEditSessionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isEditingSession || isSubmittingEditSession) return;
    setIsSubmittingEditSession(true);
    try {
      const formData = new FormData(e.currentTarget);

      const res = await editSession(isEditingSession.id, formData);
      if (res?.error) {
        showNotice(`Error: ${res.error}`);
        return;
      }

      // The court count is saved on this session; the server only changes the real
      // courts if this is the live session (otherwise they switch when it starts).
      setIsEditingSession(null);
      showNotice(
        "warning" in res && res.warning ? res.warning : "Session settings updated successfully!"
      );
    } finally {
      setIsSubmittingEditSession(false);
    }
  }

  function handleResetQueue() {
    const targetSessionId = activeSession?.id || sessions[0]?.id;
    if (!targetSessionId) {
      showNotice("No active session found to reset queue for.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Reset Active Queue",
      message: "Are you sure you want to clear the entire active queue? This will remove all waiting players from the paddle queue. Completed match history remains safe.",
      confirmLabel: "Yes, Reset Queue",
      isDestructive: true,
      action: async () => {
        await resetSessionQueue(targetSessionId);
        showNotice("Session queue has been cleared.");
        router.refresh();
      },
    });
  }

  async function startSessionAndOpenConsole(session: Session) {
    if (actionLoadingId === session.id) return;
    setActionLoadingId(session.id);
    try {
      const res = await updateSessionStatus(session.id, "active");
      if (res?.error) {
        showNotice(`Error: ${res.error}`);
        return;
      }
      if ("warning" in res && res.warning) alert(res.warning);
      // Go straight to the console: that's where players are queued and courts are run.
      router.push(`/sessions/${session.id}`);
    } finally {
      setActionLoadingId(null);
    }
  }

  function handleStartSession(session: Session) {
    // Only one session can be live; starting another ends the current one.
    if (activeSession && activeSession.id !== session.id) {
      setConfirmModal({
        isOpen: true,
        title: `Start "${session.title}"?`,
        message: `"${activeSession.title}" is still live. Starting this session will end it, free its courts and clear its queue.`,
        confirmLabel: "End it & start this one",
        isDestructive: true,
        action: () => startSessionAndOpenConsole(session),
      });
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: `Start "${session.title}"?`,
      message:
        "Everyone going will be shuffled into the line, courts open for games, and \"I'm going\" closes. Start only when you're at the courts.",
      confirmLabel: "Yes, start session",
      isDestructive: false,
      action: () => startSessionAndOpenConsole(session),
    });
  }

  function handleCancelSession(session: Session) {
    setConfirmModal({
      isOpen: true,
      title: `Cancel Session: "${session.title}"`,
      message: "Are you sure you want to cancel this scheduled session? This cannot be undone.",
      confirmLabel: "Yes, Cancel Session",
      isDestructive: true,
      action: async () => {
        setSessions((prev) =>
          prev.map((item) => (item.id === session.id ? { ...item, status: "cancelled" } : item))
        );
        await cancelSession(session.id);
        showNotice(`Session "${session.title}" cancelled.`);
      },
    });
  }

  async function handleCourtScale(num: number) {
    setIsScalingCourts(true);
    const res = await setRentedCourtCount(num, "Standard Court");
    setIsScalingCourts(false);
    if (res?.error) {
      showNotice(`Error: ${res.error}`);
    } else if (res?.courts) {
      setCourts(
        res.courts.map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          surface: c.surface_type || "Standard Court",
          assignedStaffId: c.assigned_staff_id || null,
        }))
      );
      showNotice(`Facility adjusted to ${num} courts!`);
      router.refresh();
    }
  }

  async function handleExportRoster() {
    setIsExportingRoster(true);
    try {
      const dataToExport = employees.map((emp) => {
        const starInfo = getStarSkillInfo(emp.skill_rating);
        const winRate =
          emp.games_played > 0
            ? `${Math.round((emp.games_won / emp.games_played) * 100)}%`
            : "N/A";
        return {
          "Full Name": emp.full_name || "N/A",
          "Display Name": emp.display_name || "N/A",
          "Email": emp.email || "Unregistered",
          "Role": emp.role.toUpperCase(),
          "Rating": Number(emp.skill_rating || 2.0).toFixed(2),
          "Skill Tier": starInfo.label,
          "Games Played": emp.games_played || 0,
          "Games Won": emp.games_won || 0,
          "Win Rate": winRate,
          "Status": emp.is_active ? "Active" : "Inactive",
        };
      });

      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DCTECH Pickleball Roster");
      XLSX.writeFile(
        workbook,
        `dctech_pickleball_roster_${getPHTTodayString()}.xlsx`
      );
      showNotice("Roster exported successfully to Excel!");
    } catch (err: any) {
      showNotice(`Export failed: ${err.message}`);
    } finally {
      setIsExportingRoster(false);
    }
  }

  function showNotice(msg: string) {
    setActionMessage(msg);
    // Errors stay up longer so they can be read.
    setTimeout(() => setActionMessage(null), /^error/i.test(msg) ? 7000 : 3500);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Admin Header */}
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Admin</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Schedule and run open play, manage players, and look up the rules.
        </p>
      </header>

      {/* Action Notification */}
      {actionMessage &&
        (/^(error|export failed)\b/i.test(actionMessage) ? (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" aria-hidden />
            <span>{actionMessage.replace(/^error:\s*/i, "")}</span>
          </div>
        ) : (
          <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
            <span>{actionMessage}</span>
          </div>
        ))}

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-800 text-sm overflow-x-auto scrollbar-none whitespace-nowrap">
        {([
          { id: "sessions", label: "Sessions", icon: Calendar },
          { id: "players", label: "Players", icon: Users },
          { id: "guide", label: "Rules & guide", icon: BookOpen },
          { id: "activity", label: "Activity", icon: History },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`-mb-px px-4 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
              activeTab === id
                ? "border-emerald-500 text-slate-900 dark:text-slate-100"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: Sessions & Rented Courts */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* Active Session & Court Arena Section */}
          {activeSession ? (
            <Card className="border-emerald-500/50 bg-white dark:bg-slate-900/80 p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    Live now, until {formatPHTTime(activeSession.end_time)}
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {activeSession.title}
                  </h2>
                  <SessionRuleChips description={activeSession.description} />
                </div>

                {/* Everything live (queue, courts, scoring, ending) happens in the console */}
                <Link
                  href={`/sessions/${activeSession.id}`}
                  className="inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-[#d4e938] hover:bg-[#c2d730] text-slate-950 text-sm font-bold transition-colors w-full sm:w-auto shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                >
                  Open session console
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>

              <dl className="grid grid-cols-3 gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <LiveStat value={courts.filter((c) => c.status === "occupied").length} label="courts in play" />
                <LiveStat value={courts.filter((c) => c.status === "available").length} label="courts open" />
                <LiveStat value={courts.filter((c) => c.status === "maintenance" || c.status === "reserved").length} label="closed" />
              </dl>

              {/* Court setup: rarely needed mid-session, so collapsed by default */}
              <details className="group space-y-3">
                <summary className="flex items-center justify-between cursor-pointer list-none select-none text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Court setup and referees ({courts.length} courts)
                  </span>
                  <span className="text-xs font-medium text-slate-500 group-open:hidden">Show</span>
                  <span className="text-xs font-medium text-slate-500 hidden group-open:inline">Hide</span>
                </summary>
              <div className="space-y-3 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Courts fill from the queue automatically. Use these only to close a court or assign a referee.
                  </p>

                  {/* Safe Quick Scale Buttons */}
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Adjust Courts:</span>
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        disabled={isScalingCourts}
                        onClick={() => handleCourtScale(num)}
                        className={`rounded px-2.5 py-0.5 border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                          courts.length === num
                            ? "border-emerald-500 bg-emerald-500 text-slate-950 font-black shadow-xs"
                            : "border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                        } disabled:opacity-50`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {courts.map((court) => (
                    <Card key={court.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{court.name}</h4>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{court.surface}</p>
                        </div>
                        <CourtStatusIndicator status={court.status} />
                      </div>

                      {/* Status Override ("occupied" is set only by starting a game) */}
                      <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                        {(["available", "maintenance", "reserved"] as CourtStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={court.status === "occupied"}
                            title={court.status === "occupied" ? "A game is in progress on this court" : undefined}
                            onClick={() => handleToggleStatus(court.id, st)}
                            className={`rounded py-1 px-1 uppercase font-semibold border text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                              court.status === st
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-500/60 font-bold shadow-2xs"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      {/* Sports Staff Monitor Assignment */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <span>REFEREE / MONITOR:</span>
                          <a
                            href={`/courts/${court.id}/monitor`}
                            className="text-xs font-bold text-emerald-600 dark:text-[#d4e938] hover:underline"
                          >
                            Umpire Mode →
                          </a>
                        </div>
                        <select
                          defaultValue={court.assignedStaffId || ""}
                          onChange={async (e) => {
                            const staffId = e.target.value || null;
                            await assignStaffToCourt(court.id, staffId);
                            showNotice(`Staff assigned to Court ${court.id}`);
                          }}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                        >
                          <option value="">-- No Referee Assigned --</option>
                          {employees
                            .filter((e) => e.role === "admin" || e.role === "player")
                            .map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.full_name || emp.display_name} ({emp.role.toUpperCase()})
                              </option>
                            ))}
                        </select>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
              </details>
            </Card>
          ) : null}

          <AdminVenuesSection venues={venues} onVenuesChange={setVenues} />

          {/* Upcoming sessions header + new session form */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upcoming</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingSession(!isCreatingSession)}
              className="font-bold h-10 px-4 cursor-pointer"
            >
              {isCreatingSession ? (
                "Close"
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  New session
                </>
              )}
            </Button>
          </div>

          {isCreatingSession && (
            <Card className="border-emerald-500/30 bg-white dark:bg-slate-950/80 p-6 space-y-4 shadow-sm">
              <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                    <input
                      type="text"
                      name="title"
                      required
                      placeholder="e.g. Wednesday Open Play"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Location</label>
                    <VenuePicker
                      venues={venues}
                      name="location"
                      defaultValue="DCTECH Sports Arena"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Starts</label>
                    <input
                      type="datetime-local"
                      name="startTime"
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ends</label>
                    <input
                      type="datetime-local"
                      name="endTime"
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Courts</label>
                    <select
                      name="courtCount"
                      defaultValue="4"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-bold"
                    >
                      <option value="2">2 courts (8 players at once)</option>
                      <option value="3">3 courts (12 players at once)</option>
                      <option value="4">4 courts (16 players at once)</option>
                      <option value="5">5 courts (20 players at once)</option>
                      <option value="6">6 courts (24 players at once)</option>
                    </select>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Only for this session. The courts switch to this number when it starts.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Partners</label>
                    <AllowPartnersToggle checked={sessionAllowPartners} onChange={setSessionAllowPartners} />
                  </div>
                </div>

                {/* Session Mode & Game Points Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {/* Mode: Ranked vs Casual */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Ratings
                      </label>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Ranked games change player ratings
                      </span>
                    </div>
                    <input type="hidden" name="isRanked" value={String(sessionIsRanked)} />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSessionIsRanked(true)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          sessionIsRanked
                            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-1 ring-emerald-500/50"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                          {sessionIsRanked && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                          <span>Ranked</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Results update player ratings and the leaderboard.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSessionIsRanked(false)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          !sessionIsRanked
                            ? "border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 ring-1 ring-purple-500/50"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-purple-700 dark:text-purple-300">
                          {!sessionIsRanked && <Check className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
                          <span>Casual</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Just for fun. Ratings and the leaderboard stay the same.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Target Score: 11 Pts vs 6 Pts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Scoring
                      </label>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        How a game is won
                      </span>
                    </div>
                    <TrackScoresToggle checked={sessionTrackScores} onChange={setSessionTrackScores} />
                    <input type="hidden" name="targetPoints" value={String(sessionTargetPoints)} />
                    {sessionTrackScores && (
                    <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSessionTargetPoints(11);
                          setSessionWinByTwo(true);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          sessionTargetPoints === 11
                            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-1 ring-emerald-500/50"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                          {sessionTargetPoints === 11 && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                          <span>11 points</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Standard pickleball game length.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSessionTargetPoints(6);
                          setSessionWinByTwo(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          sessionTargetPoints === 6
                            ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-1 ring-amber-500/50"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                          {sessionTargetPoints === 6 && <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                          <span>6 points</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Shorter games for busy nights.
                        </p>
                      </button>
                    </div>
                    <WinByTwoToggle
                      checked={sessionWinByTwo}
                      onChange={setSessionWinByTwo}
                      targetPoints={sessionTargetPoints}
                    />
                    </>
                    )}
                  </div>
                </div>

                {/* Pickleq-Style Matching Mode Selector */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Matchmaking
                    </label>
                    <Link
                      href="/guide?tab=matchstyles"
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      Style guide
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {/* Hidden form input to submit selected value */}
                  <input type="hidden" name="matchingStyle" value={selectedMatchingMode} />

                  <div className="space-y-2">
                    {ADMIN_PRIMARY_MATCHING_STYLES.map((style) => {
                      const isSelected = selectedMatchingMode === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSelectedMatchingMode(style.id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>{style.label}</span>
                              {style.id === "balanced" && (
                                <span className="ml-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.2 uppercase tracking-wider">
                                  RECOMMENDED
                                </span>
                              )}
                              {style.id === "social_mixer" && (
                                <span className="ml-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 text-[10px] font-bold px-2 py-0.2 uppercase tracking-wider">
                                  NEW
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {style.adminSummary}
                          </p>
                        </button>
                      );
                    })}

                    {/* More modes & formats (Collapsible) */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowMoreMatchingModes(!showMoreMatchingModes)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            More modes & formats
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {ADMIN_MORE_MATCHING_STYLES.map((s) => s.label).join(" · ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                          <span>{showMoreMatchingModes ? "Hide options" : "Show options"}</span>
                          {showMoreMatchingModes ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </button>

                      {showMoreMatchingModes && (
                        <div className="p-3 pt-0 space-y-2 border-t border-slate-200 dark:border-slate-800/60 mt-1">
                          {ADMIN_MORE_MATCHING_STYLES.map((style) => {
                            const isSelected = selectedMatchingMode === style.id;
                            return (
                              <button
                                key={style.id}
                                type="button"
                                onClick={() => setSelectedMatchingMode(style.id)}
                                className={`w-full p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                                  isSelected
                                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                                  {isSelected && (
                                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  )}
                                  <span>{style.label}</span>
                                  {style.badge === "BETA" && (
                                    <span className="ml-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 text-[10px] font-bold px-2 py-0.2 uppercase tracking-wider">
                                      BETA
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {style.adminSummary}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(selectedMatchingMode === "skill_separated" || selectedMatchingMode === "skill_courts") && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Max rating spread</label>
                    <input
                      type="number"
                      name="skillSpread"
                      step={0.25}
                      min={0.25}
                      max={2}
                      value={createSkillSpread}
                      onChange={(e) => setCreateSkillSpread(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Players more than this apart in rating won&apos;t share a court.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="e.g. 4-on / 4-off paddle rotation queue active for all skill levels."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="submit"
                    variant="volt"
                    size="sm"
                    loading={isSubmittingSession}
                    disabled={isSubmittingSession}
                    className="font-bold text-xs"
                  >
                    {isSubmittingSession ? "Creating session…" : "Create session"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Session lists: upcoming first, past folded away */}
          {(() => {
            const upcoming = sessions
              .filter((s) => s.status === "scheduled")
              .sort((a, b) => a.start_time.localeCompare(b.start_time));
            const past = sessions
              .filter((s) => s.status === "completed" || s.status === "cancelled")
              .sort((a, b) => b.start_time.localeCompare(a.start_time));

            return (
              <>
                {upcoming.length === 0 ? (
                  !isCreatingSession && (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nothing scheduled</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Create a session so players can see it and check in.
                      </p>
                    </div>
                  )
                ) : (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                    {upcoming.map((s) => (
                      <SessionRow key={s.id} session={s} rsvpCount={rsvpCounts[s.id]}>
                        <Button
                          variant="volt"
                          size="sm"
                          loading={actionLoadingId === s.id}
                          disabled={actionLoadingId === s.id}
                          onClick={() => handleStartSession(s)}
                          className="h-10 px-4 font-bold cursor-pointer"
                        >
                          {actionLoadingId === s.id ? "Starting…" : "Start"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingSession(s)}
                          className="h-10 cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelSession(s)}
                          className="h-10 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          aria-label={`Cancel ${s.title}`}
                        >
                          Cancel
                        </Button>
                      </SessionRow>
                    ))}
                  </ul>
                )}

                {past.length > 0 && (
                  <details className="group">
                    <summary className="flex items-center justify-between cursor-pointer list-none select-none py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Past sessions ({past.length})
                      <span className="text-xs font-medium text-slate-500 group-open:hidden">Show</span>
                      <span className="text-xs font-medium text-slate-500 hidden group-open:inline">Hide</span>
                    </summary>
                    <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                      {past.map((s) => (
                        <SessionRow key={s.id} session={s} muted>
                          {s.status === "completed" ? (
                            <Link
                              href={`/sessions/${s.id}`}
                              className="inline-flex h-10 items-center rounded-md border border-slate-300 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Results
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-500 dark:text-slate-400">Cancelled</span>
                          )}
                        </SessionRow>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            );
          })()}

          {/* Edit Session Modal */}
          <Modal
            isOpen={Boolean(isEditingSession)}
            onClose={() => setIsEditingSession(null)}
          >
            {isEditingSession && (
              <Card className="w-full max-w-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default max-h-[90vh] overflow-y-auto">
                <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    Edit session
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Change the name, time, or game rules for &quot;{isEditingSession.title}&quot;.
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <form onSubmit={handleEditSessionSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                        <input
                          type="text"
                          name="title"
                          required
                          defaultValue={isEditingSession.title}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Location</label>
                        <VenuePicker
                          key={isEditingSession.id}
                          venues={venues}
                          name="location"
                          defaultValue={isEditingSession.location || "DCTECH Sports Arena"}
                          defaultVenueId={isEditingSession.venue_id}
                          className="dark:bg-slate-950 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Starts</label>
                        <input
                          type="datetime-local"
                          name="startTime"
                          required
                          defaultValue={toPHTDateTimeLocal(isEditingSession.start_time)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ends</label>
                        <input
                          type="datetime-local"
                          name="endTime"
                          required
                          defaultValue={toPHTDateTimeLocal(isEditingSession.end_time)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Mode & Target Score Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rating Mode</label>
                        <input type="hidden" name="isRanked" value={String(editIsRanked)} />
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditIsRanked(true)}
                            className={`p-2 rounded-lg border text-xs font-bold text-center cursor-pointer transition-colors ${
                              editIsRanked
                                ? "border-emerald-500 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            Ranked
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditIsRanked(false)}
                            className={`p-2 rounded-lg border text-xs font-bold text-center cursor-pointer transition-colors ${
                              !editIsRanked
                                ? "border-purple-500 bg-purple-50/60 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            Casual
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Scoring</label>
                        <TrackScoresToggle checked={editTrackScores} onChange={setEditTrackScores} />
                        <input type="hidden" name="targetPoints" value={String(editTargetPoints)} />
                        {editTrackScores && (
                        <>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTargetPoints(11);
                              setEditWinByTwo(true);
                            }}
                            className={`p-2 rounded-lg border text-xs font-bold text-center cursor-pointer transition-colors ${
                              editTargetPoints === 11
                                ? "border-emerald-500 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            🏆 11 Pts
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTargetPoints(6);
                              setEditWinByTwo(false);
                            }}
                            className={`p-2 rounded-lg border text-xs font-bold text-center cursor-pointer transition-colors ${
                              editTargetPoints === 6
                                ? "border-amber-500 bg-amber-50/60 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            ⚡ 6 Pts
                          </button>
                        </div>
                        <WinByTwoToggle
                          checked={editWinByTwo}
                          onChange={setEditWinByTwo}
                          targetPoints={editTargetPoints}
                        />
                        </>
                        )}
                      </div>
                    </div>

                    {/* Matching Mode + Courts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Matching Mode</label>
                      <select
                        name="matchingStyle"
                        defaultValue={editMatchingMode}
                        onChange={(e) => setEditMatchingMode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      >
                        {ADMIN_SELECT_MATCHING_STYLES.map((style) => (
                          <option key={style.id} value={style.id}>
                            {style.id === "balanced" ? `${style.label} (Recommended)` : style.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Courts</label>
                      {(() => {
                        // Each session keeps its own court count. Older sessions without one
                        // fall back to the courts the live session has, else the default.
                        const own = parseSessionMetadata(isEditingSession.description).courtCount;
                        const isLive = isEditingSession.status === "active";
                        const current = own ?? (isLive ? courts.length : DEFAULT_COURT_COUNT);
                        const options = Array.from(new Set([1, 2, 3, 4, 5, 6, current])).sort((a, b) => a - b);
                        return (
                          <>
                            <select
                              name="courtCount"
                              defaultValue={String(current)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-bold"
                            >
                              {options.map((n) => (
                                <option key={n} value={n}>
                                  {n} {n === 1 ? "court" : "courts"} ({n * 4} players at once)
                                </option>
                              ))}
                            </select>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {isLive
                                ? "This session is live, so courts change right away. A court with a game in progress can't be removed."
                                : "Only for this session. The courts switch to this number when it starts."}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Partners</label>
                      <AllowPartnersToggle checked={editAllowPartners} onChange={setEditAllowPartners} />
                    </div>

                    {(editMatchingMode === "skill_separated" || editMatchingMode === "skill_courts") && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Max rating spread</label>
                        <input
                          type="number"
                          name="skillSpread"
                          step={0.25}
                          min={0.25}
                          max={2}
                          value={editSkillSpread}
                          onChange={(e) => setEditSkillSpread(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Players more than this apart in rating won&apos;t share a court.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes (optional)</label>
                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={cleanSessionDescription(isEditingSession.description)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingSession(null)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="volt"
                        size="sm"
                        loading={isSubmittingEditSession}
                        disabled={isSubmittingEditSession}
                        className="font-bold text-xs"
                      >
                        {isSubmittingEditSession ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </Modal>
        </div>
      )}

      {/* Tab 2: Player & Staff Directory */}
      {activeTab === "players" && (
        <>
          {/* Fast Add Modal */}
          <Modal
            isOpen={isAddingPlayer}
            onClose={() => setIsAddingPlayer(false)}
          >
            <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default">
                <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    Add Walk-In / Guest Player
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quickly add an unregistered colleague or guest player to the directory.
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!walkInName) return;
                      const res = await createWalkInPlayer({
                        fullName: walkInName,
                        email: walkInType === "employee" && walkInEmail.trim() ? walkInEmail.trim() : undefined,
                        isGuest: walkInType === "guest",
                        skillRating: walkInRating,
                      });
                      if (res?.error) {
                        showNotice(`Error: ${res.error}`);
                      } else {
                        showNotice(`Added player "${walkInName}"!`);
                        setIsAddingPlayer(false);
                        setWalkInName("");
                        setWalkInEmail("");
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Player Full Name</label>
                      <input
                        type="text"
                        required
                        value={walkInName}
                        onChange={(e) => setWalkInName(e.target.value)}
                        placeholder="e.g. Michael Chen"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Player Type</label>
                        <select
                          value={walkInType}
                          onChange={(e) => setWalkInType(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                        >
                          <option value="guest">Guest / Plus-One</option>
                          <option value="employee">DCTECH Employee (Unregistered)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Initial Skill Level (Stars)</label>
                        <select
                          value={walkInRating}
                          onChange={(e) => setWalkInRating(parseFloat(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono font-medium"
                        >
                          <option value="2.0">★☆☆☆☆☆ Beginner (2.0)</option>
                          <option value="2.5">★★☆☆☆☆ Adv. Beginner (2.5)</option>
                          <option value="3.0">★★★☆☆☆ Intermediate (3.0)</option>
                          <option value="3.5">★★★★☆☆ Adv. Intermediate (3.5)</option>
                          <option value="4.0">★★★★★☆ Advanced (4.0)</option>
                          <option value="4.5">★★★★★★ Expert (4.5+)</option>
                        </select>
                      </div>
                    </div>

                    {walkInType === "employee" && (
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

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingPlayer(false);
                          setWalkInEmail("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" variant="volt" size="sm" className="font-bold text-xs">
                        Add to Directory
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
          </Modal>

          {/* Edit Player Details Modal */}
          <Modal
            isOpen={Boolean(editingPlayer)}
            onClose={() => {
              setEditingPlayer(null);
              setEditPlayerName("");
              setEditPlayerEmail("");
            }}
          >
            {editingPlayer && (
              <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default">
                <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    Edit Player Profile
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update player name or company email address for directory sync and login linking.
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!editPlayerName.trim() || !editPlayerEmail.trim()) return;
                      setIsUpdatingPlayer(true);
                      const res = await updatePlayerDetails(
                        editingPlayer.id,
                        editPlayerName.trim(),
                        editPlayerEmail.trim()
                      );
                      setIsUpdatingPlayer(false);
                      if (res?.error) {
                        showNotice(`Error: ${res.error}`);
                      } else {
                        setEmployees((prev) =>
                          prev.map((emp) =>
                            emp.id === editingPlayer.id
                              ? {
                                  ...emp,
                                  full_name: editPlayerName.trim(),
                                  display_name: editPlayerName.trim(),
                                  email: editPlayerEmail.trim(),
                                }
                              : emp
                          )
                        );
                        showNotice(`Updated player profile for "${editPlayerName.trim()}"!`);
                        setEditingPlayer(null);
                        setEditPlayerName("");
                        setEditPlayerEmail("");
                        router.refresh();
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Player Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editPlayerName}
                        onChange={(e) => setEditPlayerName(e.target.value)}
                        placeholder="e.g. Michael Chen"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                      <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Company Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={editPlayerEmail}
                        onChange={(e) => setEditPlayerEmail(e.target.value)}
                        placeholder="e.g. michael.chen@dctechmicro.com"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-mono"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        Updating this address allows unregistered walk-ins or employees with typos to link seamlessly to their corporate account.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUpdatingPlayer}
                        onClick={() => {
                          setEditingPlayer(null);
                          setEditPlayerName("");
                          setEditPlayerEmail("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="volt"
                        size="sm"
                        disabled={isUpdatingPlayer}
                        className="font-bold text-xs"
                      >
                        {isUpdatingPlayer ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </Modal>

          {/* Change rating (System Admin) */}
          <Modal isOpen={Boolean(ratingTarget)} onClose={() => !isSavingRating && setRatingTarget(null)}>
            {ratingTarget && (
              <Card className="w-full max-w-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default p-5 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Change {ratingTarget.full_name || ratingTarget.display_name || "player"}&apos;s rating
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Now {formatRating(ratingTarget.skill_rating)} ({ratingLevel(ratingTarget.skill_rating)}). Saved to their history as an admin edit.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {RATING_PRESETS.map((preset) => {
                    const on = Number(ratingDraft) === preset.rating;
                    return (
                      <button
                        key={preset.rating}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setRatingDraft(preset.rating.toFixed(2))}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs cursor-pointer ${
                          on
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                            : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="font-mono font-semibold">{preset.rating.toFixed(1)}</span>
                      </button>
                    );
                  })}
                </div>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Exact rating ({RATING_RULES.min.toFixed(2)} to {RATING_RULES.max.toFixed(2)})
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.05"
                    min={RATING_RULES.min}
                    max={RATING_RULES.max}
                    value={ratingDraft}
                    onChange={(e) => setRatingDraft(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </label>
                {ratingError && (
                  <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{ratingError}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" disabled={isSavingRating} onClick={() => setRatingTarget(null)} className="text-xs cursor-pointer">
                    Cancel
                  </Button>
                  <Button type="button" variant="volt" size="sm" loading={isSavingRating} disabled={isSavingRating} onClick={saveRating} className="text-xs font-bold cursor-pointer">
                    Save rating
                  </Button>
                </div>
              </Card>
            )}
          </Modal>

          <PlayerDirectory
            players={employees}
            viewerIsSystemAdmin={viewerIsSystemAdmin}
            headerActions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExportingRoster}
                  onClick={handleExportRoster}
                  className="font-semibold text-xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-emerald-500" aria-hidden />
                  {isExportingRoster ? "Exporting…" : "Export to Excel"}
                </Button>
                <Button variant="volt" size="sm" onClick={() => setIsAddingPlayer(true)} className="font-bold text-xs cursor-pointer">
                  <UserPlus className="h-3.5 w-3.5 mr-1" aria-hidden />
                  Add walk-in
                </Button>
              </>
            }
            actions={{
              onToggleActive: toggleActive,
              onChangeRole: (p, role) => handleRoleChange(p.id, role),
              onChangeRating: (p) => {
                setRatingTarget(p);
                setRatingDraft(Number(p.skill_rating ?? RATING_RULES.start).toFixed(2));
                setRatingError(null);
              },
              onEdit: (p) => {
                setEditingPlayer(p);
                setEditPlayerName(p.full_name || p.display_name || "");
                setEditPlayerEmail(p.email || "");
              },
              onResetPassword: handleResetPassword,
              onViewPhoto: (p) =>
                p.avatar_url &&
                setPhotoTarget({ id: p.id, name: p.full_name || p.display_name || "Player", avatarUrl: p.avatar_url }),
            }}
          />
        </>
      )}

      {/* Tab 3: Operations & Referee Guide */}
      {activeTab === "activity" && (
        <AdminAuditView
          sessions={sessions}
          names={Object.fromEntries(employees.map((e) => [e.id, e.full_name || e.display_name || "A player"]))}
        />
      )}

      {activeTab === "guide" && <AdminRulesGuide />}

      {/* Player photo: view full size; only the System Admin can remove it */}
      <PlayerPhotoViewer
        target={photoTarget}
        canRemove={viewerIsSystemAdmin}
        onClose={() => setPhotoTarget(null)}
        onRemoved={(id) => {
          setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, avatar_url: null } : e)));
          showNotice("Photo removed.");
        }}
      />

      {/* Custom Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmModal?.isOpen)}
        onClose={() => setConfirmModal(null)}
      >
        {confirmModal?.isOpen && (
          <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  confirmModal.isDestructive
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Admin Action Required
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmModal(null)}
                className="text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirmModal.isDestructive ? "destructive" : "volt"}
                size="sm"
                disabled={isConfirmModalSubmitting}
                loading={isConfirmModalSubmitting}
                onClick={async () => {
                  if (isConfirmModalSubmitting) return;
                  setIsConfirmModalSubmitting(true);
                  try {
                    const act = confirmModal.action;
                    await act();
                    setConfirmModal(null);
                  } finally {
                    setIsConfirmModalSubmitting(false);
                  }
                }}
                className="text-xs font-mono font-bold cursor-pointer"
              >
                {confirmModal.confirmLabel || "Confirm"}
              </Button>
            </div>
          </Card>
        )}
      </Modal>
    </div>
  );
}

function WinByTwoToggle({
  checked,
  onChange,
  targetPoints,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  targetPoints: number;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 cursor-pointer select-none">
      <input type="hidden" name="winByTwo" value={checked ? "true" : "false"} />
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-emerald-500"
      />
      <span className="space-y-0.5">
        <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">Win by 2</span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
          {checked
            ? `At ${targetPoints - 1}-${targetPoints - 1} play continues until a team leads by 2 (e.g. ${targetPoints + 1}-${targetPoints - 1}).`
            : `First to ${targetPoints} wins. At ${targetPoints - 1}-${targetPoints - 1} the next point ends the game (${targetPoints}-${targetPoints - 1}).`}
        </span>
      </span>
    </label>
  );
}

function TrackScoresToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 cursor-pointer select-none">
      <input type="hidden" name="trackScores" value={checked ? "true" : "false"} />
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-emerald-500"
      />
      <span className="space-y-0.5">
        <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">Track scores</span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
          {checked
            ? "Record points for each game. Point difference breaks leaderboard ties."
            : "Win/loss only: tap the team that won, no points to enter. Leaderboard ties go to win rate."}
        </span>
      </span>
    </label>
  );
}

/** Whether players may join this session's line with a partner (coworker or guest). */
function AllowPartnersToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 cursor-pointer select-none">
      <input type="hidden" name="allowPartners" value={checked ? "true" : "false"} />
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-emerald-500"
      />
      <span className="space-y-0.5">
        <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">Allow partners</span>
        <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
          {checked
            ? "Players can join with a coworker or guest and always play on the same team."
            : "Everyone joins solo; the game mode makes all the teams."}
        </span>
      </span>
    </label>
  );
}

function LiveStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

