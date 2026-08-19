"use client";

import { useState, useEffect } from "react";
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
  Lock,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourtStatusIndicator } from "@/components/layout/CourtStatusIndicator";
import { toggleCourtStatus, updatePlayerRole, adjustPlayerRating, resetSessionQueue, assignStaffToCourt, setRentedCourtCount, createWalkInPlayer } from "../api/adminActions";
import { createSession, updateSessionStatus } from "@/features/sessions/api/sessionActions";
import { formatRating } from "@/lib/utils";
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
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInType, setWalkInType] = useState<"guest" | "employee">("guest");
  const [walkInRating, setWalkInRating] = useState<number>(3.0);

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
  const employees: Profile[] = initialEmployees;

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

  async function handleToggleStatus(courtId: string, newStatus: CourtStatus) {
    setCourts((prev) =>
      prev.map((c) => (c.id === courtId ? { ...c, status: newStatus } : c))
    );
    await toggleCourtStatus(courtId, newStatus);
    showNotice(`Court ${courtId} status set to ${newStatus.toUpperCase()}`);
    router.refresh();
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    await updatePlayerRole(userId, newRole);
    showNotice(`Player role updated to ${newRole.toUpperCase()}`);
    router.refresh();
  }

  async function handleRatingChange(userId: string, delta: number) {
    const emp = employees.find((e) => e.id === userId);
    if (!emp) return;
    const newRating = Math.max(1.0, Math.min(6.0, Number((emp.skill_rating + delta).toFixed(2))));
    await adjustPlayerRating(userId, newRating);
    showNotice(`Rating updated to ${newRating.toFixed(2)}`);
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
      setCourts(
        Array.from({ length: courtCount }, (_, i) => ({
          id: String(i + 1),
          name: `Court ${i + 1}`,
          status: "available" as CourtStatus,
          surface: "Standard Court",
        }))
      );
      setIsCreatingSession(false);
      showNotice(`Session created and ${courtCount} rented courts provisioned!`);
      router.refresh();
    }
  }

  async function handleResetQueue() {
    if (confirm("Are you sure you want to clear the entire active queue?")) {
      await resetSessionQueue("s1");
      showNotice("Session queue has been reset.");
    }
  }

  function showNotice(msg: string) {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
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
            className="text-xs font-mono"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Reset Queue
          </Button>
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
      <div className="flex border-b border-slate-200 dark:border-slate-800 font-mono text-xs">
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeSession.title}</h3>
                    <Badge variant="default" className="text-[10px] uppercase font-mono">
                      ACTIVE NOW
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    {new Date(activeSession.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                    {new Date(activeSession.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} •{" "}
                    {activeSession.location || "DCTECH Sports Arena"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (confirm(`Finish and conclude "${activeSession.title}"?`)) {
                        setSessions((prev) =>
                          prev.map((item) => (item.id === activeSession.id ? { ...item, status: "completed" } : item))
                        );
                        await updateSessionStatus(activeSession.id, "completed");
                        showNotice(`Session "${activeSession.title}" concluded!`);
                        router.refresh();
                      }
                    }}
                    className="text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-mono"
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

                  {/* Quick Scale Buttons */}
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] mr-1">Adjust Courts:</span>
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={async () => {
                          const newCourts = Array.from({ length: num }, (_, i) => ({
                            id: String(i + 1),
                            name: `Court ${i + 1}`,
                            status: "available" as CourtStatus,
                            surface: "Standard Court",
                          }));
                          setCourts(newCourts);
                          const res = await setRentedCourtCount(num, "Standard Court");
                          if (res?.error) {
                            showNotice(`Error: ${res.error}`);
                          } else {
                            showNotice(`Facility adjusted to ${num} courts!`);
                            router.refresh();
                          }
                        }}
                        className={`rounded px-2.5 py-0.5 border text-xs font-bold transition-all shadow-2xs ${
                          courts.length === num
                            ? "border-emerald-500 bg-emerald-500 text-slate-950 font-black shadow-xs"
                            : "border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                        }`}
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Queue Matching & Rotation Style</label>
                    <select
                      name="matchingStyle"
                      defaultValue="balanced"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono font-bold"
                    >
                      <option value="balanced">⚖️ Balanced DUPR Matching (Recommended)</option>
                      <option value="fifo">⏱️ Classic FIFO (4-on / 4-off)</option>
                      <option value="winners_stay">👑 King of the Court (Winners Stay)</option>
                      <option value="social_mixer">🔀 Social Mixer (Max Variety)</option>
                    </select>
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
              sessions.map((s) => (
                <Card key={s.id} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.title}</h4>
                      <Badge
                        variant={s.status === "active" ? "default" : "secondary"}
                        className="text-[10px] uppercase font-mono"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} •{" "}
                      {new Date(s.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                      {new Date(s.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs w-full sm:w-auto">
                    {s.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (confirm(`Finish and conclude "${s.title}"?`)) {
                            setSessions((prev) =>
                              prev.map((item) => (item.id === s.id ? { ...item, status: "completed" } : item))
                            );
                            await updateSessionStatus(s.id, "completed");
                            showNotice(`Session "${s.title}" completed!`);
                            router.refresh();
                          }
                        }}
                        className="text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs w-full sm:w-auto"
                      >
                        Finish / End Session
                      </Button>
                    ) : (
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
                        className="text-xs w-full sm:w-auto font-bold"
                      >
                        Start Session
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Player & Staff Directory */}
      {activeTab === "players" && (
        <>
          {/* Fast Add Modal */}
          {isAddingPlayer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
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
                        isGuest: walkInType === "guest",
                        skillRating: walkInRating,
                      });
                      if (res?.error) {
                        showNotice(`Error: ${res.error}`);
                      } else {
                        showNotice(`Added player "${walkInName}"!`);
                        setIsAddingPlayer(false);
                        setWalkInName("");
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
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Initial DUPR</label>
                        <select
                          value={walkInRating}
                          onChange={(e) => setWalkInRating(parseFloat(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                        >
                          <option value="2.5">2.50 (Beginner)</option>
                          <option value="3.0">3.00 (Intermediate)</option>
                          <option value="3.5">3.50 (Advanced)</option>
                          <option value="4.0">4.00 (Pro)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAddingPlayer(false)}
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

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-200">
                  Employee Role & DUPR Skill Adjustments ({employees.length})
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage coworker ratings, roles, and open-play eligibility.
                </p>
              </div>
              <Button
                variant="volt"
                size="sm"
                onClick={() => setIsAddingPlayer(true)}
                className="font-bold text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                + Add Walk-In / Guest Player
              </Button>
            </CardHeader>
          <CardContent className="p-0">
            {employees.length === 0 ? (
              <div className="py-12 text-center font-mono text-xs text-slate-400 space-y-2">
                <Users className="h-7 w-7 text-slate-400 dark:text-slate-600 mx-auto" />
                <p className="text-slate-900 dark:text-slate-200 font-semibold">No Registered Players Found</p>
                <p className="text-slate-500 text-[11px]">
                  When employees sign up or log in, their profiles will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
                        {emp.full_name?.charAt(0) || emp.display_name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">
                            {emp.full_name || emp.display_name}
                          </h4>
                          <Badge
                            variant={emp.role === "admin" ? "volt" : "secondary"}
                            className="text-[10px] uppercase font-mono"
                          >
                            {emp.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          Rating: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatRating(emp.skill_rating)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Rating Incrementer */}
                      <div className="flex items-center gap-1 font-mono text-xs bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleRatingChange(emp.id, -0.1)}
                          className="px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold"
                        >
                          -0.1
                        </button>
                        <span className="px-1 text-slate-900 dark:text-slate-300 font-bold">
                          {formatRating(emp.skill_rating)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRatingChange(emp.id, 0.1)}
                          className="px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold"
                        >
                          +0.1
                        </button>
                      </div>

                      {/* Role Selector */}
                      <select
                        defaultValue={emp.role}
                        onChange={(e) => handleRoleChange(emp.id, e.target.value as UserRole)}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1 text-xs text-slate-900 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                      >
                        <option value="player">Player</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                ))}
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
                As an Administrator, you manage the event lifecycle, rented court count, and paddle lines. Live court scoreboards and paddle queues activate only when an Admin starts a session.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">Step 1: Create Session</div>
                  <div>In the Sessions tab above, set Title, Venue, and number of Rented Courts (2 to 6).</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">Step 2: Start Session</div>
                  <div>Click Start Session to open live court scoreboards and paddle rotation lines.</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">Step 3: Manage Queue</div>
                  <div>Use Bulk Pre-Queue, Bump late players, Swap spots, or Call Next Up.</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">Step 4: Finish Session</div>
                  <div>Click Finish Session to save game records, update DUPR ratings, and reset courts to Standby.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Queue Management Tools */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Queue Operations (On the Queue Screen)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            </div>
          </div>

          {/* Referee & Umpire Station */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Staff Referee & Umpire Station Guide
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Staff umpires or designated tablet stations manage court match flow and score tracking on active courts.
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 font-mono divide-y divide-slate-200 dark:divide-slate-800/80">
              <div className="pt-2 flex items-start gap-3">
                <span className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400">1</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Point Stepper:</strong> Tap <span className="text-emerald-600 dark:text-emerald-400 font-bold">+ Point</span> whenever the serving team scores a point. Public arena scoreboards update live.
                </div>
              </div>

              <div className="pt-2 flex items-start gap-3">
                <span className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400">2</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Side Out / Fault:</strong> Tap <span className="text-amber-600 dark:text-amber-400 font-bold">Side Out</span> to advance Server 1 to Server 2, or transfer serve possession to the opposing team.
                </div>
              </div>

              <div className="pt-2 flex items-start gap-3">
                <span className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sky-600 dark:text-sky-400">3</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Call Queue (4 Players):</strong> When a match finishes, tap <span className="text-sky-600 dark:text-sky-400 font-bold">Call Next Up</span> to summon the next pod from the paddle rack directly to this court.
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
    </div>
  );
}
