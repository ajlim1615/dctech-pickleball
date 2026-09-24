"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Calendar,
  Users,
  RefreshCw,
  Plus,
  Check,
  PlayCircle,
  Clock,
  Zap,
  Activity,
  UserPlus,
  BookOpen,
  FastForward,
  ArrowLeftRight,
  UserCheck,
  UserX,
  Lock,
  Layers,
  Search,
  Filter,
  Mail,
  Trophy,
  ChevronDown,
  ChevronUp,
  Star,
  Sparkles,
  Flame,
  Download,
  Edit3,
  Pencil,
  XCircle,
  ExternalLink,
  Power,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourtStatusIndicator } from "@/components/layout/CourtStatusIndicator";
import {
  toggleCourtStatus,
  updatePlayerRole,
  adjustPlayerRating,
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
import { formatRating, parseSessionMetadata } from "@/lib/utils";
import type { CourtStatus, UserRole, Profile, Session, ActiveCourtView } from "@/types";

interface AdminDashboardProps {
  initialEmployees?: Profile[];
  initialSessions?: Session[];
  initialCourts?: ActiveCourtView[];
}

export function AdminDashboard({
  initialEmployees = [],
  initialSessions = [],
  initialCourts = [],
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"sessions" | "players" | "guide">("sessions");
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
  const [playerTierFilter, setPlayerTierFilter] = useState<string>("all");
  const [playerSearch, setPlayerSearch] = useState<string>("");

  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isEditingSession, setIsEditingSession] = useState<Session | null>(null);
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
  const [showMoreMatchingModes, setShowMoreMatchingModes] = useState<boolean>(false);

  // Session Edit Config State
  const [editMatchingMode, setEditMatchingMode] = useState<string>("balanced");
  const [editIsRanked, setEditIsRanked] = useState<boolean>(true);
  const [editTargetPoints, setEditTargetPoints] = useState<number>(11);

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

  // Sync edit modal state when an existing session is selected
  useEffect(() => {
    if (isEditingSession) {
      const meta = parseSessionMetadata(isEditingSession.description);
      setEditMatchingMode(meta.matchingMode);
      setEditIsRanked(meta.isRanked);
      setEditTargetPoints(meta.targetPoints);
    }
  }, [isEditingSession]);

  // 6-Star Skill Tiers (Exact Mapping)
  const SKILL_STAR_TIERS = [
    { stars: 0, label: "Set skill", dupr: 2.0 },
    { stars: 1, label: "Beginner (~2.0 DUPR)", dupr: 2.0 },
    { stars: 2, label: "Adv. Beginner (~2.5 DUPR)", dupr: 2.5 },
    { stars: 3, label: "Intermediate (~3.0 DUPR)", dupr: 3.0 },
    { stars: 4, label: "Adv. Intermediate (~3.5 DUPR)", dupr: 3.5 },
    { stars: 5, label: "Advanced (~4.0 DUPR)", dupr: 4.0 },
    { stars: 6, label: "Expert (~4.5+ DUPR)", dupr: 4.5 },
  ];

  function getStarSkillInfo(rating?: number | null) {
    const r = Number(rating || 0);
    if (r <= 0) return { stars: 0, label: "Set skill", dupr: 2.0 };
    if (r < 2.25) return { stars: 1, label: "Beginner (~2.0 DUPR)", dupr: 2.0 };
    if (r < 2.75) return { stars: 2, label: "Adv. Beginner (~2.5 DUPR)", dupr: 2.5 };
    if (r < 3.25) return { stars: 3, label: "Intermediate (~3.0 DUPR)", dupr: 3.0 };
    if (r < 3.75) return { stars: 4, label: "Adv. Intermediate (~3.5 DUPR)", dupr: 3.5 };
    if (r < 4.25) return { stars: 5, label: "Advanced (~4.0 DUPR)", dupr: 4.0 };
    return { stars: 6, label: "Expert (~4.5+ DUPR)", dupr: 4.5 };
  }

  // Single-pass Skill Tier Counts for Quick Filter Chips
  const { countBeginners, countIntermediate, countAdvanced, countAdmins, countInactive } = useMemo(() => {
    let beginners = 0;
    let intermediate = 0;
    let advanced = 0;
    let admins = 0;
    let inactive = 0;

    for (const e of employees) {
      if (!e.is_active) {
        inactive++;
      }
      if (e.role === "admin" || e.email?.toLowerCase() === "admin@dctechmicro.com") {
        admins++;
      }
      const s = getStarSkillInfo(e.skill_rating).stars;
      if (s === 1 || s === 2) beginners++;
      else if (s === 3 || s === 4) intermediate++;
      else if (s >= 5) advanced++;
    }

    return {
      countBeginners: beginners,
      countIntermediate: intermediate,
      countAdvanced: advanced,
      countAdmins: admins,
      countInactive: inactive,
    };
  }, [employees]);

  function getPlayerTier(rating: number) {
    const info = getStarSkillInfo(rating);
    if (info.stars >= 4) return { label: info.label, badge: "border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40" };
    if (info.stars === 3) return { label: info.label, badge: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40" };
    if (info.stars === 2) return { label: info.label, badge: "border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40" };
    return { label: info.label, badge: "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40" };
  }

  const filteredEmployees = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();

    return employees.filter((emp) => {
      if (query) {
        const matchesSearch =
          (emp.full_name || emp.display_name || "").toLowerCase().includes(query) ||
          (emp.email || "").toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (playerTierFilter === "inactive") return !emp.is_active;
      if (!emp.is_active && playerTierFilter !== "all") return false;

      if (playerTierFilter === "all") return true;
      if (playerTierFilter === "beginners") {
        const s = getStarSkillInfo(emp.skill_rating).stars;
        return s === 1 || s === 2;
      }
      if (playerTierFilter === "intermediate") {
        const s = getStarSkillInfo(emp.skill_rating).stars;
        return s === 3 || s === 4;
      }
      if (playerTierFilter === "advanced") {
        const s = getStarSkillInfo(emp.skill_rating).stars;
        return s >= 5;
      }
      if (playerTierFilter === "admins") {
        return emp.role === "admin" || emp.email?.toLowerCase() === "admin@dctechmicro.com";
      }

      const starInfo = getStarSkillInfo(emp.skill_rating);
      return starInfo.stars === parseInt(playerTierFilter, 10);
    });
  }, [employees, playerSearch, playerTierFilter]);

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
    router.refresh();
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const emp = employees.find((e) => e.id === userId);
    if (emp?.email?.toLowerCase() === "admin@dctechmicro.com") {
      showNotice("System Admin role is permanent and cannot be modified.");
      return;
    }
    setEmployees((prev) =>
      prev.map((e) => (e.id === userId ? { ...e, role: newRole } : e))
    );
    showNotice(`Updated role to ${newRole.toUpperCase()}`);
    await updatePlayerRole(userId, newRole);
    router.refresh();
  }

  async function handleRatingChange(playerId: string, delta: number) {
    const player = employees.find((e) => e.id === playerId);
    if (!player || player.email?.toLowerCase() === "admin@dctechmicro.com") return;
    const newRating = Math.max(1.0, Math.min(6.0, (player.skill_rating || 3.0) + delta));
    const rounded = Math.round(newRating * 100) / 100;
    setEmployees((prev) =>
      prev.map((e) => (e.id === playerId ? { ...e, skill_rating: rounded } : e))
    );
    await adjustPlayerRating(playerId, rounded);
    showNotice(`Updated skill rating for player.`);
    router.refresh();
  }

  async function handleSetRating(playerId: string, newRating: number) {
    const emp = employees.find((e) => e.id === playerId);
    if (emp?.email?.toLowerCase() === "admin@dctechmicro.com") {
      showNotice("System Admin does not participate in matches or ratings.");
      return;
    }
    const rounded = Math.round(newRating * 100) / 100;
    setEmployees((prev) =>
      prev.map((e) => (e.id === playerId ? { ...e, skill_rating: rounded } : e))
    );
    const starInfo = getStarSkillInfo(rounded);
    showNotice(`Updated ${emp?.full_name || "player"} to ${starInfo.label}`);
    await adjustPlayerRating(playerId, rounded);
    router.refresh();
  }

  async function handleCreateSessionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const countStr = (formData.get("courtCount") as string) || "4";
    const courtCount = parseInt(countStr, 10) || 4;

    const res = await createSession(formData);
    if (res?.error) {
      showNotice(`Error: ${res.error}`);
    } else {
      setIsCreatingSession(false);
      showNotice(`Session created and ${courtCount} rented courts provisioned!`);
      router.refresh();
    }
  }

  async function handleEditSessionSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isEditingSession) return;
    const formData = new FormData(e.currentTarget);

    const res = await editSession(isEditingSession.id, formData);
    if (res?.error) {
      showNotice(`Error: ${res.error}`);
    } else {
      setIsEditingSession(null);
      showNotice("Session settings updated successfully!");
      router.refresh();
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

  function handleFinishSession(session: Session) {
    setConfirmModal({
      isOpen: true,
      title: `Finish Session: "${session.title}"`,
      message: "Conclude this session? Active courts will be freed, pending queue entries will be cleared, and official match records will be finalized.",
      confirmLabel: "Finish & Conclude",
      isDestructive: false,
      action: async () => {
        setSessions((prev) =>
          prev.map((item) => (item.id === session.id ? { ...item, status: "completed" } : item))
        );
        await updateSessionStatus(session.id, "completed");
        showNotice(`Session "${session.title}" concluded!`);
        router.refresh();
      },
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
        router.refresh();
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
          "DUPR Rating": Number(emp.skill_rating || 3.0).toFixed(2),
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
        `dctech_pickleball_roster_${new Date().toISOString().split("T")[0]}.xlsx`
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
    setTimeout(() => setActionMessage(null), 3500);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 backdrop-blur-md shadow-sm transition-colors">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="volt" className="text-xs">
              ADMIN CONTROL PANEL
            </Badge>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              DCTECH Recreation Committee
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
            Session & Staff Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Schedule open-play events, manage rented courts, assign referees, and administer player ratings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetQueue}
            className="text-xs font-mono cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Reset Queue
          </Button>
        </div>
      </div>

      {/* Live Admin Pulse KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Session Status */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
            <span>ACTIVE SESSION</span>
            {activeSession ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
            )}
          </div>
          <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
            {activeSession ? activeSession.title : "No Active Session"}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
            {activeSession ? (
              <>
                {parseSessionMetadata(activeSession.description).isRanked ? "🏆 Ranked" : "🍃 Lowkey / Casual"} •{" "}
                {parseSessionMetadata(activeSession.description).targetPoints} pts
              </>
            ) : (
              "Schedule open play below"
            )}
          </div>
        </div>

        {/* Metric 2: Courts Online */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 space-y-1 shadow-2xs">
          <div className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>COURTS IN USE</span>
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
            {courts.filter((c) => c.status === "occupied").length}{" "}
            <span className="text-xs font-normal text-slate-500">/ {courts.length} Courts</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {courts.filter((c) => c.status === "available").length} available for play
          </div>
        </div>

        {/* Metric 3: Active Roster */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 space-y-1 shadow-2xs">
          <div className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>ROSTER PULSE</span>
            <Users className="h-3.5 w-3.5 text-sky-500" />
          </div>
          <div className="text-xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
            {employees.filter((e) => e.is_active).length}{" "}
            <span className="text-xs font-normal text-slate-500">/ {employees.length} Total</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {countBeginners} Novice • {countIntermediate} Int • {countAdvanced} Adv
          </div>
        </div>

        {/* Metric 4: Facility Arena Direct Navigation */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-4 space-y-1 shadow-2xs">
          <div className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>QUICK NAVIGATION</span>
            <Zap className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <a
              href="/queue"
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-500 transition-colors"
            >
              Queue →
            </a>
            <a
              href="/"
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-500 transition-colors"
            >
              Kiosk →
            </a>
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            One-tap direct station links
          </div>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-mono">
          <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Streamlined Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 font-mono text-xs overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`px-5 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sessions"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Sessions & Rented Courts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("players")}
          className={`px-5 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "players"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users className="h-4 w-4" />
          Player & Staff Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("guide")}
          className={`px-5 py-2.5 font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "guide"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Operations & Referee Manual
        </button>
      </div>

      {/* Tab 1: Sessions & Rented Courts */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* Active Session & Court Arena Section */}
          {activeSession ? (
            <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-500/20 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeSession.title}</h3>
                    <Badge variant="default" className="text-[10px] uppercase font-mono">
                      ACTIVE NOW
                    </Badge>

                    {/* Mode & Target Score Badges */}
                    {parseSessionMetadata(activeSession.description).isRanked ? (
                      <Badge variant="volt" className="text-[10px] font-mono font-bold">
                        🏆 Ranked
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300">
                        🍃 Casual / Lowkey (Unranked)
                      </span>
                    )}

                    {parseSessionMetadata(activeSession.description).targetPoints === 6 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                        ⚡ Speed Play (6 Pts)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                        🏆 Standard (11 Pts)
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    {new Date(activeSession.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                    {new Date(activeSession.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} •{" "}
                    {activeSession.location || "DCTECH Sports Arena"}
                  </p>
                </div>

                {/* Direct Station Links & Finish Button */}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/sessions/${activeSession.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-mono font-bold shadow-xs transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Court Station →
                  </a>
                  <a
                    href="/queue"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono font-bold transition-colors"
                  >
                    Paddle Queue →
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFinishSession(activeSession)}
                    className="text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-mono cursor-pointer"
                  >
                    Finish Session
                  </Button>
                </div>
              </div>

              {/* Rented Courts for this Active Session */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h4 className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="h-4 w-4" />
                    Rented Courts for this Session ({courts.length})
                  </h4>

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

                      {/* Status Override */}
                      <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                        {(["available", "occupied", "maintenance", "reserved"] as CourtStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleToggleStatus(court.id, st)}
                            className={`rounded py-1 px-1 uppercase font-semibold border text-center transition-all ${
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
            </Card>
          ) : null}

          {/* Schedule Session Header & Form */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              Schedule Open Play Session
            </h3>
            <Button
              variant="volt"
              size="sm"
              onClick={() => setIsCreatingSession(!isCreatingSession)}
              className="font-bold text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {isCreatingSession ? "Close Form" : "Schedule New Session"}
            </Button>
          </div>

          {isCreatingSession && (
            <Card className="border-emerald-500/30 bg-white dark:bg-slate-950/80 p-6 space-y-4 shadow-sm">
              <form onSubmit={handleCreateSessionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Session Title</label>
                    <input
                      type="text"
                      name="title"
                      required
                      placeholder="e.g. Wednesday Open Play"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Location</label>
                    <input
                      type="text"
                      name="location"
                      defaultValue="DCTECH Sports Arena"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Start Time</label>
                    <input
                      type="datetime-local"
                      name="startTime"
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">End Time</label>
                    <input
                      type="datetime-local"
                      name="endTime"
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Rented Courts for this Session</label>
                    <select
                      name="courtCount"
                      defaultValue="4"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono font-bold"
                    >
                      <option value="2">2 Courts (8 Players active)</option>
                      <option value="3">3 Courts (12 Players active)</option>
                      <option value="4">4 Courts (16 Players active)</option>
                      <option value="5">5 Courts (20 Players active)</option>
                      <option value="6">6 Courts (24 Players active)</option>
                    </select>
                  </div>
                </div>

                {/* Session Mode & Game Points Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {/* Mode: Ranked vs Casual */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                        Session Rating Mode
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Affects global DUPR
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
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {sessionIsRanked && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                          <span>🏆 Ranked</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Official match scores update DUPR & Leaderboard.
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
                        <div className="flex items-center gap-1.5 font-bold text-xs text-purple-700 dark:text-purple-300 font-mono">
                          {!sessionIsRanked && <Check className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
                          <span>🍃 Casual</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Casual open-play. ZERO impact on DUPR or leaderboard.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Target Score: 11 Pts vs 6 Pts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                        Target Game Score
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Match win condition
                      </span>
                    </div>
                    <input type="hidden" name="targetPoints" value={String(sessionTargetPoints)} />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSessionTargetPoints(11)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          sessionTargetPoints === 11
                            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-1 ring-emerald-500/50"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {sessionTargetPoints === 11 && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                          <span>🏆 11 Points</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Standard Pickleball rule (win by 2 points).
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSessionTargetPoints(6)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          sessionTargetPoints === 6
                            ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-1 ring-amber-500/50"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300 font-mono">
                          {sessionTargetPoints === 6 && <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                          <span>⚡ 6 Pts Speed</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Rapid finish for high attendance & quick court rotations.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pickleq-Style Matching Mode Selector */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                      Matching mode
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Queue rotation strategy
                    </span>
                  </div>

                  {/* Hidden form input to submit selected value */}
                  <input type="hidden" name="matchingStyle" value={selectedMatchingMode} />

                  <div className="space-y-2">
                    {/* 1. Balanced (Recommended) */}
                    <button
                      type="button"
                      onClick={() => setSelectedMatchingMode("balanced")}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                        selectedMatchingMode === "balanced"
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {selectedMatchingMode === "balanced" && (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>Balanced</span>
                          <span className="ml-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.2 font-mono uppercase tracking-wider">
                            RECOMMENDED
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Balances teams by rating. Avoids repeat matchups when possible.
                      </p>
                    </button>

                    {/* 2. Social Mix (New) */}
                    <button
                      type="button"
                      onClick={() => setSelectedMatchingMode("social_mixer")}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                        selectedMatchingMode === "social_mixer"
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {selectedMatchingMode === "social_mixer" && (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>Social Mix</span>
                          <span className="ml-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 text-[10px] font-bold px-2 py-0.2 font-mono uppercase tracking-wider">
                            NEW
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Avoids repeat partners and opponents. Doesn&apos;t use ratings.
                      </p>
                    </button>

                    {/* 3. Skill Separated */}
                    <button
                      type="button"
                      onClick={() => setSelectedMatchingMode("skill_separated")}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                        selectedMatchingMode === "skill_separated"
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                        {selectedMatchingMode === "skill_separated" && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>Skill Separated</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Keeps similar skill levels together. May leave a court waiting.
                      </p>
                    </button>

                    {/* 4. Winners / Losers */}
                    <button
                      type="button"
                      onClick={() => setSelectedMatchingMode("winners_losers")}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                        selectedMatchingMode === "winners_losers"
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                        {selectedMatchingMode === "winners_losers" && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>Winners / Losers</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Winners play winners. Losers play losers.
                      </p>
                    </button>

                    {/* More modes & formats (Collapsible) */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowMoreMatchingModes(!showMoreMatchingModes)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors font-mono"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            More modes & formats
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Skill Courts · Mixed Doubles · King/Queen · Club Wars
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
                          {/* 5. Skill Courts */}
                          <button
                            type="button"
                            onClick={() => setSelectedMatchingMode("skill_courts")}
                            className={`w-full p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                              selectedMatchingMode === "skill_courts"
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                              {selectedMatchingMode === "skill_courts" && (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>Skill Courts</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Give each skill group its own courts and queue.
                            </p>
                          </button>

                          {/* 6. Mixed Doubles */}
                          <button
                            type="button"
                            onClick={() => setSelectedMatchingMode("mixed_doubles")}
                            className={`w-full p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                              selectedMatchingMode === "mixed_doubles"
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                              {selectedMatchingMode === "mixed_doubles" && (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>Mixed Doubles</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Every team has one male and one female player.
                            </p>
                          </button>

                          {/* 7. King/Queen of the Court */}
                          <button
                            type="button"
                            onClick={() => setSelectedMatchingMode("king_queen")}
                            className={`w-full p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                              selectedMatchingMode === "king_queen"
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                              {selectedMatchingMode === "king_queen" && (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>King/Queen of the Court</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Winners move up. Losers move down.
                            </p>
                          </button>

                          {/* 8. Club Wars */}
                          <button
                            type="button"
                            onClick={() => setSelectedMatchingMode("club_wars")}
                            className={`w-full p-2.5 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                              selectedMatchingMode === "club_wars"
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                              {selectedMatchingMode === "club_wars" && (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              )}
                              <span>Club Wars</span>
                              <span className="ml-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 text-[10px] font-bold px-2 py-0.2 font-mono uppercase tracking-wider">
                                BETA
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Two groups compete. Every match is one group vs the other.
                            </p>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="e.g. 4-on / 4-off paddle rotation queue active for all skill levels."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="submit" variant="volt" size="sm" className="font-bold text-xs">
                    Publish Session & Provision Courts
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Existing Sessions Quick Controls */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Scheduled & Past Sessions ({sessions.length})
            </h4>

            {sessions.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-8 text-center space-y-2 font-mono text-xs text-slate-500 dark:text-slate-400 shadow-sm">
                <Calendar className="h-6 w-6 text-slate-400 dark:text-slate-600 mx-auto" />
                <p className="text-slate-900 dark:text-slate-200 font-semibold">No Sessions Scheduled</p>
                <p className="text-slate-500 text-[11px]">
                  Click &quot;Schedule New Session&quot; above to schedule an open-play event.
                </p>
              </Card>
            ) : (
              sessions.map((s) => {
                const meta = parseSessionMetadata(s.description);
                return (
                  <Card key={s.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.title}</h4>
                        <Badge
                          variant={s.status === "active" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-mono"
                        >
                          {s.status}
                        </Badge>

                        {/* Mode & Target Score Badges */}
                        {meta.isRanked ? (
                          <Badge variant="volt" className="text-[10px] font-mono">
                            🏆 Ranked
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300">
                            🍃 Casual
                          </span>
                        )}

                        {meta.targetPoints === 6 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                            ⚡ 6 Pts
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                            11 Pts
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} •{" "}
                        {new Date(s.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                        {new Date(s.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} •{" "}
                        {s.location || "DCTECH Sports Arena"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs w-full sm:w-auto">
                      {s.status === "active" ? (
                        <>
                          <a
                            href={`/sessions/${s.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-mono font-bold transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Station
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFinishSession(s)}
                            className="text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs w-full sm:w-auto cursor-pointer"
                          >
                            Finish Session
                          </Button>
                        </>
                      ) : (
                        <>
                          {s.status !== "cancelled" && s.status !== "completed" && (
                            <Button
                              variant="volt"
                              size="sm"
                              onClick={async () => {
                                setSessions((prev) =>
                                  prev.map((item) => (item.id === s.id ? { ...item, status: "active" } : item))
                                );
                                if (courts.length === 0) {
                                  setCourts(
                                    Array.from({ length: 4 }, (_, i) => ({
                                      id: String(i + 1),
                                      name: `Court ${i + 1}`,
                                      status: "available" as CourtStatus,
                                      surface: "Standard Court",
                                    }))
                                  );
                                }
                                await updateSessionStatus(s.id, "active");
                                showNotice(`Session "${s.title}" is now ACTIVE!`);
                                router.refresh();
                              }}
                              className="text-xs font-bold cursor-pointer"
                            >
                              Start Session
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingSession(s)}
                            className="text-xs font-mono border-slate-300 dark:border-slate-700 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1 text-slate-500" />
                            Edit
                          </Button>
                          {s.status !== "cancelled" && s.status !== "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelSession(s)}
                              className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-mono cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Edit Session Modal */}
          {isEditingSession && (
            <div
              onClick={() => setIsEditingSession(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 cursor-pointer"
            >
              <Card
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="w-full max-w-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default max-h-[90vh] overflow-y-auto"
              >
                <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    Edit Session Settings
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update title, schedule, rating mode, and match rules for &quot;{isEditingSession.title}&quot;.
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <form onSubmit={handleEditSessionSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Session Title</label>
                        <input
                          type="text"
                          name="title"
                          required
                          defaultValue={isEditingSession.title}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Location</label>
                        <input
                          type="text"
                          name="location"
                          defaultValue={isEditingSession.location || "DCTECH Sports Arena"}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Start Time</label>
                        <input
                          type="datetime-local"
                          name="startTime"
                          required
                          defaultValue={isEditingSession.start_time ? new Date(isEditingSession.start_time).toISOString().slice(0, 16) : ""}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">End Time</label>
                        <input
                          type="datetime-local"
                          name="endTime"
                          required
                          defaultValue={isEditingSession.end_time ? new Date(isEditingSession.end_time).toISOString().slice(0, 16) : ""}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Mode & Target Score Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">Rating Mode</label>
                        <input type="hidden" name="isRanked" value={String(editIsRanked)} />
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditIsRanked(true)}
                            className={`p-2 rounded-lg border text-xs font-mono font-bold text-center cursor-pointer transition-colors ${
                              editIsRanked
                                ? "border-emerald-500 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            🏆 Ranked
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditIsRanked(false)}
                            className={`p-2 rounded-lg border text-xs font-mono font-bold text-center cursor-pointer transition-colors ${
                              !editIsRanked
                                ? "border-purple-500 bg-purple-50/60 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            🍃 Casual
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">Target Score</label>
                        <input type="hidden" name="targetPoints" value={String(editTargetPoints)} />
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditTargetPoints(11)}
                            className={`p-2 rounded-lg border text-xs font-mono font-bold text-center cursor-pointer transition-colors ${
                              editTargetPoints === 11
                                ? "border-emerald-500 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            🏆 11 Pts
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTargetPoints(6)}
                            className={`p-2 rounded-lg border text-xs font-mono font-bold text-center cursor-pointer transition-colors ${
                              editTargetPoints === 6
                                ? "border-amber-500 bg-amber-50/60 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            ⚡ 6 Pts
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Matching Mode */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Matching Mode</label>
                      <select
                        name="matchingStyle"
                        defaultValue={editMatchingMode}
                        onChange={(e) => setEditMatchingMode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                      >
                        <option value="balanced">Balanced (Recommended)</option>
                        <option value="social_mixer">Social Mix</option>
                        <option value="skill_separated">Skill Separated</option>
                        <option value="winners_losers">Winners / Losers</option>
                        <option value="skill_courts">Skill Courts</option>
                        <option value="mixed_doubles">Mixed Doubles</option>
                        <option value="king_queen">King/Queen of the Court</option>
                        <option value="club_wars">Club Wars</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={isEditingSession.description ? isEditingSession.description.replace(/\[matching_mode:[^\]]+\]\s*/g, "").replace(/\[ranked:[^\]]+\]\s*/g, "").replace(/\[target_points:[^\]]+\]\s*/g, "").trim() : ""}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingSession(null)}
                        className="text-xs font-mono"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" variant="volt" size="sm" className="font-bold text-xs font-mono">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Player & Staff Directory */}
      {activeTab === "players" && (
        <>
          {/* Fast Add Modal */}
          {isAddingPlayer && (
            <div
              onClick={() => setIsAddingPlayer(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 cursor-pointer"
            >
              <Card
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default"
              >
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
                        router.refresh();
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Player Full Name</label>
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
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Player Type</label>
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
                          <option value="2.0">★☆☆☆☆☆ Beginner (~2.0 DUPR)</option>
                          <option value="2.5">★★☆☆☆☆ Adv. Beginner (~2.5 DUPR)</option>
                          <option value="3.0">★★★☆☆☆ Intermediate (~3.0 DUPR)</option>
                          <option value="3.5">★★★★☆☆ Adv. Intermediate (~3.5 DUPR)</option>
                          <option value="4.0">★★★★★☆ Advanced (~4.0 DUPR)</option>
                          <option value="4.5">★★★★★★ Expert (~4.5+ DUPR)</option>
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
                          Syncs match history and DUPR automatically when they log in with this email.
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
            </div>
          )}

          {/* Edit Player Details Modal */}
          {editingPlayer && (
            <div
              onClick={() => {
                setEditingPlayer(null);
                setEditPlayerName("");
                setEditPlayerEmail("");
              }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 cursor-pointer"
            >
              <Card
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default"
              >
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
            </div>
          )}

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-200">
                  Player & Staff Directory ({employees.length} Players)
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage coworker ratings, roles, and open-play eligibility by skill categories.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isExportingRoster}
                  onClick={handleExportRoster}
                  className="font-bold text-xs font-mono border-slate-300 dark:border-slate-700 hover:border-emerald-500 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                  {isExportingRoster ? "Exporting..." : "Export Roster (.xlsx)"}
                </Button>
                <Button
                  variant="volt"
                  size="sm"
                  onClick={() => setIsAddingPlayer(true)}
                  className="font-bold text-xs cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  + Add Walk-In Player
                </Button>
              </div>
            </CardHeader>

            {/* 1. 📊 Stat Overview Bar: Clickable Quick-Filter Chips & Search */}
            <div className="p-3.5 bg-slate-50/90 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Quick Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 md:pb-0">
                {[
                  { id: "all", label: "All Players", count: employees.length, icon: Users },
                  { id: "beginners", label: "Beginners (1-2★)", count: countBeginners, icon: Sparkles },
                  { id: "intermediate", label: "Intermediate (3-4★)", count: countIntermediate, icon: Flame },
                  { id: "advanced", label: "Advanced / Expert (5-6★)", count: countAdvanced, icon: Trophy },
                  { id: "admins", label: "Admins", count: countAdmins, icon: ShieldCheck },
                  { id: "inactive", label: "Inactive", count: countInactive, icon: UserX },
                ].map((chip) => {
                  const isActive = playerTierFilter === chip.id;
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setPlayerTierFilter(chip.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 border cursor-pointer ${
                        isActive
                          ? "bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 border-slate-900 dark:border-emerald-500 shadow-2xs"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isActive ? "text-emerald-400 dark:text-slate-950" : "text-slate-400"}`} />
                      <span>{chip.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64 shrink-0">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Search player or email..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8.5 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none shadow-2xs font-mono"
                />
              </div>
            </div>

            <CardContent className="p-0">
              {filteredEmployees.length === 0 ? (
                <div className="py-12 text-center font-mono text-xs text-slate-400 space-y-2">
                  <Users className="h-7 w-7 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="text-slate-900 dark:text-slate-200 font-semibold">No Players Match this Category/Search</p>
                  <p className="text-slate-500 text-[11px]">
                    Try choosing a different skill tier or clearing the search bar.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredEmployees.map((emp) => {
                    const isSystemAdmin = emp.email?.toLowerCase() === "admin@dctechmicro.com";
                    const tierInfo = getPlayerTier(emp.skill_rating);
                    const starInfo = getStarSkillInfo(emp.skill_rating);

                    return (
                      <div
                        key={emp.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors ${
                          !emp.is_active ? "opacity-65 bg-slate-50/40 dark:bg-slate-950/20" : ""
                        }`}
                      >
                        {/* Player Profile Column */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 shrink-0 overflow-hidden shadow-2xs">
                            {emp.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={emp.avatar_url}
                                alt={emp.full_name || "Avatar"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              emp.full_name?.charAt(0) || emp.display_name?.charAt(0) || "P"
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {emp.full_name || emp.display_name}
                              </h4>
                              <Badge
                                variant={emp.role === "admin" ? "volt" : "secondary"}
                                className="text-[10px] uppercase font-mono px-2 py-0.5"
                              >
                                {isSystemAdmin ? "System Admin" : emp.role}
                              </Badge>
                              {!emp.is_active && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] uppercase font-mono px-2 py-0.5"
                                >
                                  Inactive
                                </Badge>
                              )}
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${
                                  isSystemAdmin
                                    ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                                    : tierInfo.badge
                                }`}
                              >
                                {isSystemAdmin ? "🛡️ Root Admin" : tierInfo.label}
                              </span>
                            </div>

                            {/* Email Subtitle & DUPR Rating */}
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex flex-wrap items-center gap-2">
                              {emp.email ? (
                                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium truncate max-w-[200px] sm:max-w-none">
                                  <Mail className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                                  {emp.email}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">No email linked</span>
                              )}
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              {isSystemAdmin ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">Non-Playing</span>
                              ) : (
                                <span>
                                  DUPR: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatRating(emp.skill_rating)}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Compact Inline Controls Column */}
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center pt-2 sm:pt-0">
                          {isSystemAdmin ? (
                            <div className="text-xs font-mono text-slate-400 dark:text-slate-500 italic bg-slate-100/70 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                              🔒 Role & Rating Locked
                            </div>
                          ) : (
                            <>
                              {/* Consolidated Skill Tier Dropdown */}
                              <div className="relative">
                                <select
                                  value={starInfo.stars}
                                  onChange={(e) => {
                                    const starVal = parseInt(e.target.value, 10);
                                    const targetTier = SKILL_STAR_TIERS.find((t) => t.stars === starVal);
                                    if (targetTier) handleSetRating(emp.id, targetTier.dupr);
                                  }}
                                  className="appearance-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 pl-3 pr-7 py-1.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none shadow-2xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                >
                                  {SKILL_STAR_TIERS.filter((t) => t.stars > 0).map((tier) => (
                                    <option
                                      key={tier.stars}
                                      value={tier.stars}
                                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                    >
                                      {"★".repeat(tier.stars)}{"☆".repeat(6 - tier.stars)} · {tier.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                              </div>

                              {/* Role Selector */}
                              <div className="relative">
                                <select
                                  defaultValue={emp.role}
                                  onChange={(e) => handleRoleChange(emp.id, e.target.value as UserRole)}
                                  className={`appearance-none rounded-xl border pl-3 pr-7 py-1.5 text-xs font-mono font-bold focus:outline-none shadow-2xs cursor-pointer transition-colors ${
                                    emp.role === "admin"
                                      ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                      : "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
                                  }`}
                                >
                                  <option value="player" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                    Player
                                  </option>
                                  <option value="admin" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                    Admin
                                  </option>
                                </select>
                                <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                              </div>

                              {/* Active / Inactive Status Toggle */}
                              <button
                                type="button"
                                title={emp.is_active ? "Click to Deactivate Player" : "Click to Activate Player"}
                                onClick={async () => {
                                  const nextState = !emp.is_active;
                                  setEmployees((prev) =>
                                    prev.map((e) => (e.id === emp.id ? { ...e, is_active: nextState } : e))
                                  );
                                  const res = await togglePlayerActiveStatus(emp.id, nextState);
                                  if (res?.error) {
                                    showNotice(`Error: ${res.error}`);
                                  } else {
                                    showNotice(`${emp.full_name || "Player"} marked ${nextState ? "ACTIVE" : "INACTIVE"}`);
                                    router.refresh();
                                  }
                                }}
                                className={`p-1.5 rounded-xl border text-xs font-mono transition-colors cursor-pointer ${
                                  emp.is_active
                                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-500/40"
                                    : "border-slate-300 dark:border-slate-700 text-slate-400 bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-500/40"
                                }`}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit Player Details (Name & Email) */}
                              <button
                                type="button"
                                title="Edit Player Name & Email"
                                onClick={() => {
                                  setEditingPlayer(emp);
                                  setEditPlayerName(emp.full_name || emp.display_name || "");
                                  setEditPlayerEmail(emp.email || "");
                                }}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab 3: Operations & Referee Guide */}
      {activeTab === "guide" && (
        <div className="space-y-6">
          {/* Admin Workflow Overview */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Administrator Core Responsibilities & Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
              <p>
                As an Administrator, you manage the session lifecycle, rented court provisioning, player queue rotations, and official match score submissions. Live court scoreboards and paddle queues activate when an Admin creates and starts a session.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">Step 1: Create Session</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">In the Sessions tab, set Title, Date/Time, and Rented Courts (2 to 6 courts).</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">Step 2: Start Session</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Click Start Session to open live court scoreboards and activate paddle queue lines.</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">Step 3: Rotate & Record</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">In the active Session view, call next 4 from queue, score games, and submit final scores.</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">Step 4: Finish Session</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Click Finish Session to save game records, update DUPR ratings, and archive courts.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pickleq Live Court Scoring Station Guide */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  Live Court Scoring Station (Session Screen)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Interactive court stations allow administrators and court umpires to manage individual courts simultaneously inside any active session.
                </p>
              </div>
              <a
                href="/courts/1/monitor"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 transition-colors shadow-2xs shrink-0 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Launch Umpire Mode →
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-4 w-4" />
                  1. Independent Court Cards
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Each rented court is rendered in its own dedicated card showing its current state: 🟢 <strong>READY / OPEN</strong> or 🔴 <strong>IN PLAY</strong> with live duration clock.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-600 dark:text-sky-400">
                  <Users className="h-4 w-4" />
                  2. 1-Click Queue Callup
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Click <strong>Call Next 4</strong> on an open court card to automatically pull the top 4 waiting players from the queue and balance teams by DUPR rating.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                  <Trophy className="h-4 w-4" />
                  3. Button Safeguard & Score
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  The <strong>Complete & Submit Match Score</strong> button remains strictly disabled on empty courts until players are called. Submitting updates player DUPR and frees the court.
                </p>
              </div>
            </div>
          </Card>

          {/* Matching Modes & Rotation Strategies Guide */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-500" />
                Queue Matching Modes & Rotation Strategies
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configurable matching modes define how waiting players are paired and rotated onto open courts during open play.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs font-mono">
              {/* Balanced */}
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-emerald-600 dark:text-emerald-400">✓ Balanced</span>
                  <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[9px] font-bold px-1.5 py-0.2 uppercase">
                    RECOMMENDED
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Pairs #1 + #4 vs #2 + #3 by DUPR rating. Keeps games competitive and evenly matched while minimizing repeat matchups.
                </p>
              </div>

              {/* Social Mix */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                  <span>Social Mix</span>
                  <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 text-[9px] font-bold px-1.5 py-0.2 uppercase">
                    NEW
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Focuses on social variety by shuffling players and avoiding repeat teammates/opponents without filtering by skill rating.
                </p>
              </div>

              {/* Skill Separated */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Skill Separated
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Groups players of similar DUPR ratings together on the same court (Intermediate with Intermediate, Novice with Novice).
                </p>
              </div>

              {/* Winners / Losers */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Winners / Losers
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Winners rotate to face other winners; losers rotate to face other losers for tiered ladder play.
                </p>
              </div>

              {/* Skill Courts */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Skill Courts
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Dedicates specific rented courts to designated rating brackets (e.g. Court 1: 3.5+, Court 2: 2.75-3.5, Court 3: Beginner).
                </p>
              </div>

              {/* Mixed Doubles */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Mixed Doubles
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Ensures each 2v2 doubles team consists of 1 male and 1 female coworker.
                </p>
              </div>

              {/* King/Queen of the Court */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  King/Queen of the Court
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Winners move up toward Court 1 (Championship court); losers move down toward the lower court.
                </p>
              </div>

              {/* Club Wars */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                  <span>Club Wars</span>
                  <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 text-[9px] font-bold px-1.5 py-0.2 uppercase">
                    BETA
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Splits participants into two team clubs (e.g. Engineering vs Product). Every match is Club A vs Club B.
                </p>
              </div>
            </div>

            {/* Engine Execution Flow Summary */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <div className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                How the Rotation Engine Executes Your Selected Mode:
              </div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-900 dark:text-slate-100">Step 1 (Paddle Line Order):</strong> When <span className="text-emerald-600 dark:text-emerald-400 font-bold">Call Next 4</span> is clicked, the engine pulls the top 4 waiting players in strict FIFO arrival order.</li>
                <li><strong className="text-slate-900 dark:text-slate-100">Step 2 (Locked Doubles Pairs):</strong> If two coworkers queued together as a pair (+Coworker), they are locked together on <span className="text-emerald-600 dark:text-emerald-400 font-bold">Team 1</span>.</li>
                <li><strong className="text-slate-900 dark:text-slate-100">Step 3 (Matching Mode Execution):</strong> The engine applies your active session mode (e.g. <em>Balanced</em> pairs #1+#4 vs #2+#3; <em>Social Mix</em> shuffles permutations; <em>Skill Separated</em> pairs tier with tier).</li>
                <li><strong className="text-slate-900 dark:text-slate-100">Step 4 (Court Dispatch):</strong> The match starts in-progress with live umpires and scoreboards. When completed, court frees up and queue automatically advances.</li>
              </ul>
            </div>
          </Card>

          {/* Admin Queue Management Tools */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Queue Operations & Rotation Lineup (/queue)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  <UserCheck className="h-4 w-4" />
                  ⚡ Bulk Pre-Queue
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Select multiple arriving coworkers from a checklist to queue them simultaneously while they are warming up or changing shoes.
                </p>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                  <FastForward className="h-4 w-4" />
                  ⏩ Bump / Play Next
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  If a player in Rack #1 is still arriving or in the restroom, click <strong>Bump</strong> to push them back 1 rack so ready players take the court immediately.
                </p>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 font-mono">
                  <ArrowLeftRight className="h-4 w-4" />
                  ⇄ Swap / Substitute
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Exchange spots between two queued players, or replace a slot with an available coworker from the directory.
                </p>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                  <UserPlus className="h-4 w-4" />
                  + Walk-In Player
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Quick-adds an unregistered coworker or external guest with an initial estimated DUPR rating (2.5, 3.0, 3.5, 4.0).
                </p>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 space-y-2 shadow-sm border-rose-500/30">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                  <RefreshCw className="h-4 w-4" />
                  🔄 Reset Queue
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Located in the top Admin Header. Instantly clears all waiting/called players for the active session (e.g. at event wrap-up or emergency stoppage) while preserving completed match history.
                </p>
              </Card>
            </div>
          </div>

          {/* Referee & Umpire Station */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Staff Referee & Umpire Station Guide
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Staff umpires or designated tablet stations manage court match flow and score tracking on active courts.
                </p>
              </div>
              <a
                href="/courts/1/monitor"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3 py-1.5 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 transition-colors shadow-2xs shrink-0 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Open Umpire Mode →
              </a>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 font-mono divide-y divide-slate-200 dark:divide-slate-800/80">
              <div className="pt-2 flex items-start gap-3">
                <span className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400">1</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Point Stepper:</strong> Tap <span className="text-emerald-600 dark:text-emerald-400 font-bold">+ Point</span> whenever the serving team scores a point. Public arena scoreboards update live with haptic vibration.
                </div>
              </div>

              <div className="pt-2 flex items-start gap-3">
                <span className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400">2</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Game to 11 (Win by 2):</strong> Matches are played to 11 points and must be won by at least 2 points. The system highlights 🏆 Game Point when reached.
                </div>
              </div>

              <div className="pt-2 flex items-start gap-3">
                <span className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sky-600 dark:text-sky-400">3</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Call Queue (4 Players):</strong> When a match finishes, tap <span className="text-sky-600 dark:text-sky-400 font-bold">Call Next 4</span> to summon the next pod from the paddle rack directly to this court.
                </div>
              </div>

              <div className="pt-2 flex items-start gap-3">
                <span className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-emerald-700 dark:text-[#d4e938]">4</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Complete & Archive Game:</strong> Finalize the official score to record win/loss stats and clear the court for the next rotation.
                </div>
              </div>
            </div>
          </Card>

          {/* Official Scoring Policy */}
          <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
              <Lock className="h-4 w-4" />
              Official Match Scoring Policy
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
              To keep the company leaderboard and DUPR ratings 100% accurate and dispute-free, <strong>only Administrators and Official Staff Umpires have permission to record and finalize match scores</strong>.
            </p>
          </Card>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div
          onClick={() => setConfirmModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 cursor-pointer"
        >
          <Card
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default p-5 space-y-4"
          >
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
                onClick={async () => {
                  const act = confirmModal.action;
                  setConfirmModal(null);
                  await act();
                }}
                className="text-xs font-mono font-bold cursor-pointer"
              >
                {confirmModal.confirmLabel || "Confirm"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
