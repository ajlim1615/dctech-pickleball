"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  UserMinus,
  UserPlus,
  UserCheck,
  Zap,
  Layers,
  Sparkles,
  Search,
  Check,
  X,
  Trash2,
  FastForward,
  ArrowLeftRight,
  Clock,
  Swords,
  Flame,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  joinQueue,
  leaveQueue,
  bulkAddPlayersToQueue,
  adminRemovePlayerFromQueue,
  bumpPlayerInQueue,
  swapQueuePlayers,
  substituteQueuePlayer,
} from "../api/queueActions";
import { createWalkInPlayer } from "@/features/admin/api/adminActions";
import { useLiveQueue } from "../hooks/useLiveQueue";
import { QueueCallupAlert } from "./QueueCallupAlert";
import { createMatchupFromPod, type MatchingStyle } from "../utils/matchingEngine";
import { formatRating } from "@/lib/utils";
import type { QueueEntryWithPlayer, Profile } from "@/types";

interface QueueBoardProps {
  initialQueue: QueueEntryWithPlayer[];
  currentUserId?: string;
  userRole?: string;
  userEmail?: string;
  sessionId?: string;
  sessionTitle?: string;
  employees?: Profile[];
  courtCount?: number;
  matchingMode?: MatchingStyle;
}

export function QueueBoard({
  initialQueue,
  currentUserId = "",
  userRole = "player",
  userEmail = "",
  sessionId = "",
  sessionTitle = "Today's Open Play",
  employees = [],
  courtCount = 3,
  matchingMode = "balanced",
}: QueueBoardProps) {
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = userRole === "admin" || isSystemAdmin;
  const router = useRouter();
  const { queue, myPosition, calledAlert, dismissAlert } = useLiveQueue(
    initialQueue,
    currentUserId
  );

  const [isJoining, setIsJoining] = useState(false);
  const [joinMode, setJoinMode] = useState<"solo" | "coworker" | "guest">("solo");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"pods" | "list">("pods");

  // Fast Walk-In Modal for Organizers
  const [isAddingWalkIn, setIsAddingWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInType, setWalkInType] = useState<"employee" | "guest">("guest");
  const [walkInRating, setWalkInRating] = useState<number>(3.0);

  // Bulk Pre-Queue Modal for Organizers
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [bulkSearch, setBulkSearch] = useState("");

  // Swap / Substitute Modal State
  const [swappingEntry, setSwappingEntry] = useState<QueueEntryWithPlayer | null>(null);
  const [swapMode, setSwapMode] = useState<"queued_player" | "employee">("queued_player");
  const [targetSwapEntryId, setTargetSwapEntryId] = useState("");
  const [targetSubEmployeeId, setTargetSubEmployeeId] = useState("");

  const alreadyQueuedIds = useMemo(
    () => new Set(queue.map((q) => q.player_id)),
    [queue]
  );

  const availableEmployees = useMemo(() => {
    const query = bulkSearch.trim().toLowerCase();
    return employees.filter((emp) => {
      if (emp.email?.toLowerCase() === "admin@dctechmicro.com") return false;
      if (!query) return true;
      return (
        emp.full_name?.toLowerCase().includes(query) ||
        emp.display_name?.toLowerCase().includes(query) ||
        emp.email?.toLowerCase().includes(query)
      );
    });
  }, [employees, bulkSearch]);

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) {
      alert("No active session scheduled.");
      return;
    }
    if (selectedBulkIds.length === 0) {
      alert("Please select at least one employee.");
      return;
    }

    setIsSubmitting(true);
    const res = await bulkAddPlayersToQueue(sessionId, selectedBulkIds);
    if (res?.error) {
      alert(`Error bulk adding: ${res.error}`);
    } else {
      setIsBulkAdding(false);
      setSelectedBulkIds([]);
      setBulkSearch("");
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) {
      alert("No active session scheduled. Please check Admin or Sessions tab.");
      return;
    }
    setIsSubmitting(true);
    const res = await joinQueue({
      sessionId,
      partnerId: joinMode === "coworker" && selectedPartnerId ? selectedPartnerId : undefined,
      guestName: joinMode === "guest" && guestName ? guestName : undefined,
    });
    if (res?.error) {
      alert(`Error joining queue: ${res.error}`);
    }
    setIsJoining(false);
    setIsSubmitting(false);
    router.refresh();
  }

  async function handleAddWalkIn(e: React.FormEvent) {
    e.preventDefault();
    if (!walkInName) return;

    setIsSubmitting(true);
    const res = await createWalkInPlayer({
      fullName: walkInName,
      email: walkInType === "employee" && walkInEmail.trim() ? walkInEmail.trim() : undefined,
      isGuest: walkInType === "guest",
      skillRating: walkInRating,
    });

    if (res?.error || !res.player) {
      alert(`Error adding walk-in: ${res?.error || "Failed"}`);
    } else {
      // Auto queue the walk-in
      if (sessionId) {
        await joinQueue({
          sessionId,
          guestName: walkInName,
        });
      }
      setIsAddingWalkIn(false);
      setWalkInName("");
      setWalkInEmail("");
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleLeave() {
    if (!sessionId) return;
    setIsSubmitting(true);
    await leaveQueue(sessionId);
    setIsSubmitting(false);
    router.refresh();
  }

  async function handleAdminRemove(entryId: string, playerName: string) {
    if (!sessionId) return;
    if (!confirm(`Remove ${playerName} from the queue? (e.g. employee busy or left)`)) {
      return;
    }
    setIsSubmitting(true);
    const res = await adminRemovePlayerFromQueue(sessionId, entryId);
    if (res?.error) {
      alert(`Error removing player: ${res.error}`);
    } else {
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleBump(entryId: string, playerName: string) {
    if (!sessionId) return;
    if (!confirm(`Bump ${playerName} to the next game/rack? (Player will play next once they arrive)`)) {
      return;
    }
    setIsSubmitting(true);
    const res = await bumpPlayerInQueue(sessionId, entryId, 4);
    if (res?.error) {
      alert(`Error bumping player: ${res.error}`);
    } else {
      router.refresh();
    }
    setIsSubmitting(false);
  }

  async function handleSwapSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !swappingEntry) return;

    setIsSubmitting(true);
    let res;
    if (swapMode === "queued_player") {
      if (!targetSwapEntryId) {
        alert("Please select another queued player to swap positions with.");
        setIsSubmitting(false);
        return;
      }
      res = await swapQueuePlayers(sessionId, swappingEntry.id, targetSwapEntryId);
    } else {
      if (!targetSubEmployeeId) {
        alert("Please select a coworker to substitute into this slot.");
        setIsSubmitting(false);
        return;
      }
      res = await substituteQueuePlayer(sessionId, swappingEntry.id, targetSubEmployeeId);
    }

    if (res?.error) {
      alert(`Error: ${res.error}`);
    } else {
      setSwappingEntry(null);
      setTargetSwapEntryId("");
      setTargetSubEmployeeId("");
      router.refresh();
    }
    setIsSubmitting(false);
  }

  // Chunk players into 4-player match pods (PickleQ style)
  const pods = useMemo(() => {
    const chunked: QueueEntryWithPlayer[][] = [];
    for (let i = 0; i < queue.length; i += 4) {
      chunked.push(queue.slice(i, i + 4));
    }
    return chunked;
  }, [queue]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Callup notification banner if called */}
      {calledAlert && (
        <QueueCallupAlert
          courtName={`Court ${calledAlert.courtId || "1"}`}
          onAcknowledge={dismissAlert}
        />
      )}

      {/* Header & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 backdrop-blur-md shadow-sm transition-colors">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="volt" className="text-xs font-mono">
              LIVE 4-ON / 4-OFF QUEUE ENGINE
            </Badge>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {courtCount} Courts Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Users className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
            Open-Play Paddle Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Session: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{sessionTitle}</span> • FIFO rotations with skill-balanced matching
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Fast Walk-In & Bulk Pre-Queue (Admin Only) */}
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkAdding(true)}
                className="text-xs font-mono border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <UserCheck className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                ⚡ Bulk Pre-Queue
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingWalkIn(true)}
                className="text-xs font-mono border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1 text-emerald-500 dark:text-emerald-400" />
                + Walk-In
              </Button>
            </>
          )}

          {!isSystemAdmin && (
            myPosition ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLeave}
                disabled={isSubmitting}
                className="text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-500/30 font-mono"
              >
                <UserMinus className="h-3.5 w-3.5 mr-1" />
                Leave Queue
              </Button>
            ) : (
              <Button
                variant="volt"
                size="sm"
                onClick={() => setIsJoining(true)}
                className="font-bold text-xs"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Join Open-Play Queue
              </Button>
            )
          )}
        </div>
      </div>

      {/* Personal Queue Status Bar */}
      {myPosition && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-emerald-700 dark:text-emerald-400 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
              You are #{myPosition} in line
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
            <span>
              Est. Wait: ~{Math.max(1, Math.ceil((myPosition * 12) / (courtCount * 4)))} mins
            </span>
            <Badge variant="default" className="text-[10px]">
              ON DECK FOR NEXT COURT
            </Badge>
          </div>
        </div>
      )}

      {/* Join Queue Modal with Solo, Coworker, & Guest (+1) Options */}
      <Modal
        isOpen={isJoining}
        onClose={() => setIsJoining(false)}
      >
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Join Open-Play Queue
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Place your digital paddle in line for the next available court.
              </p>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Queue Format
                  </label>
                  <div className={`grid ${isAdmin ? "grid-cols-3" : "grid-cols-2"} gap-1.5 font-mono text-xs`}>
                    <button
                      type="button"
                      onClick={() => setJoinMode("solo")}
                      className={`rounded-lg p-2 border text-center transition-all ${
                        joinMode === "solo"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Solo
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinMode("coworker")}
                      className={`rounded-lg p-2 border text-center transition-all ${
                        joinMode === "coworker"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      + Coworker
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setJoinMode("guest")}
                        className={`rounded-lg p-2 border text-center transition-all ${
                          joinMode === "guest"
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        + Guest / +1
                      </button>
                    )}
                  </div>
                </div>

                {joinMode === "coworker" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Select Registered Coworker
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={(e) => setSelectedPartnerId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                    >
                      <option value="">-- Select Coworker --</option>
                      {employees
                        .filter((e) => e.id !== currentUserId && e.email?.toLowerCase() !== "admin@dctechmicro.com")
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name || e.display_name} ({e.skill_rating.toFixed(2)})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {joinMode === "guest" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Guest / Plus-One Name
                    </label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Mark T. (Guest)"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Guests enter the queue paired with you for doubles open play.
                    </p>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsJoining(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="volt"
                    size="sm"
                    disabled={isSubmitting}
                    className="font-bold text-xs"
                  >
                    {isSubmitting ? "Joining..." : "Confirm & Enter Queue"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
      </Modal>

      {/* Fast Add Walk-In Modal for Organizers */}
      <Modal
        isOpen={isAddingWalkIn}
        onClose={() => setIsAddingWalkIn(false)}
      >
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl cursor-default">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                Add Walk-In / Guest Player
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quick-add a coworker without their phone or an external guest.
              </p>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <form onSubmit={handleAddWalkIn} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Player Name</label>
                  <input
                    type="text"
                    required
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder="e.g. John Doe"
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
                      setIsAddingWalkIn(false);
                      setWalkInEmail("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="volt"
                    size="sm"
                    disabled={isSubmitting}
                    className="font-bold text-xs"
                  >
                    {isSubmitting ? "Adding..." : "Add & Enqueue Player"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
      </Modal>

      {/* Bulk Pre-Queue Modal for Organizers */}
      <Modal
        isOpen={isBulkAdding}
        onClose={() => setIsBulkAdding(false)}
      >
        <Card className="w-full max-w-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[85vh]">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-500" />
                  Bulk Pre-Queue Employees
                </CardTitle>
                <Badge variant="volt" className="text-[10px] font-mono font-bold">
                  {selectedBulkIds.length} Selected
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pre-queue employees who are warming up or preparing so rotation pods are filled.
              </p>
            </CardHeader>

            <CardContent className="pt-4 flex-1 flex flex-col overflow-hidden space-y-3">
              {/* Search & Quick Select Controls */}
              <div className="space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={bulkSearch}
                    onChange={(e) => setBulkSearch(e.target.value)}
                    placeholder="Search by coworker name or email..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Showing {availableEmployees.length} registered employees
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const unqueuedAvailable = availableEmployees
                          .filter((e) => !alreadyQueuedIds.has(e.id))
                          .map((e) => e.id);
                        setSelectedBulkIds(unqueuedAvailable);
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                    >
                      Select All Available
                    </button>
                    <span className="text-slate-400">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedBulkIds([])}
                      className="text-[11px] text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Employee Checklist */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 max-h-64">
                {availableEmployees.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 font-mono">
                    No employees matching &quot;{bulkSearch}&quot;
                  </div>
                ) : (
                  availableEmployees.map((emp) => {
                    const isQueued = alreadyQueuedIds.has(emp.id);
                    const isSelected = selectedBulkIds.includes(emp.id);

                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center justify-between p-3 text-xs transition-colors cursor-pointer ${
                          isQueued
                            ? "opacity-50 cursor-not-allowed bg-slate-100/50 dark:bg-slate-900/40"
                            : isSelected
                            ? "bg-emerald-50/80 dark:bg-emerald-950/30"
                            : "hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={isQueued}
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBulkIds([...selectedBulkIds, emp.id]);
                              } else {
                                setSelectedBulkIds(selectedBulkIds.filter((id) => id !== emp.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {emp.full_name || emp.display_name}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {emp.email || "DCTECH Team"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono font-bold">
                            DUPR {formatRating(emp.skill_rating || 3.5)}
                          </Badge>
                          {isQueued && (
                            <Badge variant="default" className="text-[10px] bg-slate-600">
                              In Queue
                            </Badge>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 shrink-0 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBulkAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="volt"
                  size="sm"
                  disabled={isSubmitting || selectedBulkIds.length === 0}
                  onClick={handleBulkAdd}
                  className="font-bold text-xs shadow-sm"
                >
                  {isSubmitting ? "Queueing..." : `Pre-Queue (${selectedBulkIds.length}) Employees`}
                </Button>
              </div>
            </CardContent>
          </Card>
      </Modal>

      {/* Swap / Substitute Modal */}
      <Modal
        isOpen={Boolean(swappingEntry)}
        onClose={() => setSwappingEntry(null)}
      >
        {swappingEntry && (
          <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-emerald-500" />
                Change / Swap Queue Position
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjusting spot for <span className="font-bold text-slate-900 dark:text-slate-100">{swappingEntry.player?.full_name || swappingEntry.player?.display_name || "Player"}</span>
              </p>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              <form onSubmit={handleSwapSubmit} className="space-y-4">
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-0.5 font-mono text-xs shadow-inner">
                  <button
                    type="button"
                    onClick={() => setSwapMode("queued_player")}
                    className={`flex-1 py-1.5 rounded-md transition-all font-bold ${
                      swapMode === "queued_player"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Swap with Queued Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwapMode("employee")}
                    className={`flex-1 py-1.5 rounded-md transition-all font-bold ${
                      swapMode === "employee"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Substitute Coworker
                  </button>
                </div>

                {swapMode === "queued_player" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Select Queued Player to Trade Spots With:
                    </label>
                    <select
                      value={targetSwapEntryId}
                      onChange={(e) => setTargetSwapEntryId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                    >
                      <option value="">-- Choose player in queue --</option>
                      {queue
                        .filter((q) => q.id !== swappingEntry.id)
                        .map((q, idx) => (
                          <option key={q.id} value={q.id}>
                            #{idx + 1} {q.player?.full_name || q.player?.display_name || "Player"} (DUPR {formatRating(q.player?.skill_rating || 3.0)})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Select Coworker to Replace This Slot:
                    </label>
                    <select
                      value={targetSubEmployeeId}
                      onChange={(e) => setTargetSubEmployeeId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none font-mono"
                    >
                      <option value="">-- Choose coworker --</option>
                      {employees
                        .filter((emp) => emp.email?.toLowerCase() !== "admin@dctechmicro.com" && !alreadyQueuedIds.has(emp.id))
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name || emp.display_name} (DUPR {formatRating(emp.skill_rating || 3.5)})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSwappingEntry(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="volt"
                    size="sm"
                    disabled={isSubmitting}
                    className="font-bold text-xs"
                  >
                    {isSubmitting ? "Updating..." : "Confirm & Swap"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </Modal>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-500 dark:text-[#d4e938]" />
          Waiting Queue ({queue.length} Players)
        </h3>

        <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-0.5 font-mono text-xs shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode("pods")}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === "pods"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            4-Paddle Racks
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === "list"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Full List
          </button>
        </div>
      </div>

      {/* Main Queue Render */}
      {queue.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-12 text-center space-y-3 font-mono text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          <Users className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto" />
          <p className="text-slate-900 dark:text-slate-200 font-semibold text-sm">The Queue is Currently Empty</p>
          <p className="text-slate-500 text-[11px] max-w-sm mx-auto">
            Click &quot;Join Open-Play Queue&quot; above to place your paddle in line for the next game.
          </p>
        </Card>
      ) : viewMode === "pods" ? (
        /* PickleQ 4-Paddle Match Rack Grid */
        <div className="space-y-6">
          {pods.map((pod, podIdx) => {
            const isNextUp = podIdx === 0;
            const isFull = pod.length === 4;
            const estWait = podIdx * 12;

            // Extract profiles for accurate matchup calculation
            const podProfiles: Profile[] = pod.map(
              (item) => ((item.player || item) as unknown) as Profile
            );
            const matchup = isFull ? createMatchupFromPod(podProfiles, matchingMode) : null;

            if (isNextUp) {
              return (
                <div
                  key={podIdx}
                  className="rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-white dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-slate-900/90 p-5 sm:p-6 space-y-5 shadow-md relative overflow-hidden"
                >
                  {/* Decorative glow */}
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-3xl pointer-events-none" />

                  {/* Up Next Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-500/20 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="volt" className="text-[11px] font-mono font-extrabold uppercase px-2.5 py-0.5 shadow-2xs">
                          🔥 RACK #1 • UP NEXT ON COURT
                        </Badge>
                        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                          {isFull ? "4 / 4 Players Matched" : `${pod.length} / 4 Players Queued`}
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        <Swords className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        Up Next 2v2 Matchup
                      </h2>
                    </div>

                    {isFull && matchup && (
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/60 px-3 py-1.5 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5 shadow-2xs">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{matchup.balanceScorePercent}% Match Balance (Δ {matchup.ratingDelta.toFixed(2)})</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2v2 Matchup Stadium Layout when Pod is Full */}
                  {isFull && matchup ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-4">
                        {/* TEAM 1 (Team A) */}
                        <div className="md:col-span-2 rounded-xl border-2 border-emerald-500/40 bg-white dark:bg-slate-900/90 p-4 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                            <span className="text-xs font-extrabold font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              Team 1
                            </span>
                            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                              Avg DUPR: <span className="text-emerald-600 dark:text-emerald-400">{matchup.teamARatingAvg.toFixed(2)}</span>
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {matchup.teamA.map((p, pIdx) => {
                              const queueItem = pod.find((item) => item.player_id === p.id);
                              const isMe = p.id === currentUserId;
                              const isGuest = p.full_name?.includes("(Guest)");

                              return (
                                <div
                                  key={p.id || pIdx}
                                  className={`rounded-lg border p-2.5 flex items-center justify-between gap-3 ${
                                    isMe
                                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-emerald-500/40"
                                      : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                                      {p.full_name?.charAt(0) || "P"}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                          {p.full_name || p.display_name || "Player"}
                                        </span>
                                        {isMe && (
                                          <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                            (YOU)
                                          </span>
                                        )}
                                        {isGuest && (
                                          <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                                            GUEST
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                        DUPR <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatRating(p.skill_rating)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {isAdmin && queueItem && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleBump(queueItem.id, p.full_name || "Player")}
                                        title="Bump player (skip 1 game)"
                                        className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                      >
                                        <FastForward className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSwappingEntry(queueItem)}
                                        title="Swap position"
                                        className="p-1 rounded text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdminRemove(queueItem.id, p.full_name || "Player")}
                                        title="Remove from queue"
                                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* CENTER VS HUB */}
                        <div className="md:col-span-1 flex flex-col items-center justify-center py-2 md:py-0 text-center">
                          <div className="h-12 w-12 rounded-2xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center font-extrabold text-sm font-mono shadow-md border-2 border-emerald-400/40">
                            VS
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase">
                            2v2 Doubles
                          </span>
                        </div>

                        {/* TEAM 2 (Team B) */}
                        <div className="md:col-span-2 rounded-xl border-2 border-sky-500/40 bg-white dark:bg-slate-900/90 p-4 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
                            <span className="text-xs font-extrabold font-mono text-sky-700 dark:text-sky-400 flex items-center gap-1.5 uppercase">
                              <span className="h-2 w-2 rounded-full bg-sky-500" />
                              Team 2
                            </span>
                            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                              Avg DUPR: <span className="text-sky-600 dark:text-sky-400">{matchup.teamBRatingAvg.toFixed(2)}</span>
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {matchup.teamB.map((p, pIdx) => {
                              const queueItem = pod.find((item) => item.player_id === p.id);
                              const isMe = p.id === currentUserId;
                              const isGuest = p.full_name?.includes("(Guest)");

                              return (
                                <div
                                  key={p.id || pIdx}
                                  className={`rounded-lg border p-2.5 flex items-center justify-between gap-3 ${
                                    isMe
                                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 ring-1 ring-emerald-500/40"
                                      : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-sky-100 dark:bg-sky-950/80 border border-sky-500/30 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                                      {p.full_name?.charAt(0) || "P"}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                          {p.full_name || p.display_name || "Player"}
                                        </span>
                                        {isMe && (
                                          <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                            (YOU)
                                          </span>
                                        )}
                                        {isGuest && (
                                          <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                                            GUEST
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                        DUPR <span className="font-bold text-sky-600 dark:text-sky-400">{formatRating(p.skill_rating)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {isAdmin && queueItem && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleBump(queueItem.id, p.full_name || "Player")}
                                        title="Bump player (skip 1 game)"
                                        className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                      >
                                        <FastForward className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSwappingEntry(queueItem)}
                                        title="Swap position"
                                        className="p-1 rounded text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdminRemove(queueItem.id, p.full_name || "Player")}
                                        title="Remove from queue"
                                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Matchup Summary Footer */}
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 text-xs font-mono text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            Next Call: <strong className="text-slate-900 dark:text-slate-100">{matchup.teamA.map(p => p.full_name?.split(" ")[0]).join(" & ")}</strong> vs <strong className="text-slate-900 dark:text-slate-100">{matchup.teamB.map(p => p.full_name?.split(" ")[0]).join(" & ")}</strong>
                          </span>
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Ready to play on next open court
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Partial Rack 1 (<4 players) */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {pod.map((item, idx) => {
                          const isMe = item.player_id === currentUserId;
                          const isGuest = item.player?.full_name?.includes("(Guest)");

                          return (
                            <div
                              key={item.id || idx}
                              className={`rounded-xl border p-3 flex items-center gap-3 transition-all shadow-xs ${
                                isMe
                                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-slate-900 dark:text-slate-100 ring-1 ring-emerald-500/30"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center font-mono font-bold text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
                                #{idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={item.player?.full_name || item.player?.display_name || "Player"}>
                                    {item.player?.full_name || item.player?.display_name || "Player"}
                                  </span>
                                  {isMe && (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold font-mono shrink-0">
                                      (YOU)
                                    </span>
                                  )}
                                  {isGuest && (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                                      GUEST
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  DUPR <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatRating(item.player?.skill_rating || 3.0)}</span>
                                </div>
                              </div>

                              {isAdmin && (
                                <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => handleBump(item.id, item.player?.full_name || "Player")}
                                    className="p-1 rounded text-slate-400 hover:text-amber-500"
                                    title="Bump"
                                  >
                                    <FastForward className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSwappingEntry(item)}
                                    className="p-1 rounded text-slate-400 hover:text-emerald-500"
                                    title="Swap"
                                  >
                                    <ArrowLeftRight className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminRemove(item.id, item.player?.full_name || "Player")}
                                    className="p-1 rounded text-slate-400 hover:text-rose-500"
                                    title="Remove"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Empty Paddle Slots */}
                        {Array.from({ length: 4 - pod.length }).map((_, emptyIdx) => (
                          <div
                            key={`empty-${emptyIdx}`}
                            className="rounded-xl border border-dashed border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 p-3 flex items-center justify-center text-center font-mono text-xs text-emerald-600/70 dark:text-emerald-400/60 min-h-[58px]"
                          >
                            <span>+ Waiting for Player {pod.length + emptyIdx + 1}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-center font-mono text-xs text-slate-500 dark:text-slate-400 pt-2">
                        Waiting for {4 - pod.length} more player{4 - pod.length > 1 ? "s" : ""} to complete this 2v2 matchup.
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Pods 2, 3, 4 (On-Deck / In-Queue Paddle Racks)
            return (
              <Card
                key={podIdx}
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-3 transition-all shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-slate-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-mono font-bold uppercase"
                    >
                      {podIdx === 1 ? "RACK #2 • ON DECK" : `RACK #${podIdx + 1} • IN QUEUE`}
                    </Badge>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {isFull ? "4 / 4 Players Matched" : `${pod.length} / 4 Players (Waiting for ${4 - pod.length})`}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Est. Court Time: ~{estWait} mins
                  </span>
                </div>

                {/* 4 Paddle Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {pod.map((item, idx) => {
                    const isMe = item.player_id === currentUserId;
                    const isGuest = item.player?.full_name?.includes("(Guest)");

                    return (
                      <div
                        key={item.id || idx}
                        className={`rounded-xl border p-3 flex items-center gap-3 transition-all shadow-2xs ${
                          isMe
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-slate-900 dark:text-slate-100 ring-1 ring-emerald-500/30"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={item.player?.full_name || item.player?.display_name || "Player"}>
                              {item.player?.full_name || item.player?.display_name || "Player"}
                            </span>
                            {isMe && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold font-mono shrink-0">
                                (YOU)
                              </span>
                            )}
                            {isGuest && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                                GUEST
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span>DUPR <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatRating(item.player?.skill_rating || 3.0)}</span></span>
                            {item.status === "called" && (
                              <Badge variant="volt" className="text-[8px] px-1 py-0 uppercase shrink-0">
                                CALLED
                              </Badge>
                            )}
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                            <button
                              type="button"
                              onClick={() =>
                                handleBump(
                                  item.id,
                                  item.player?.full_name || item.player?.display_name || "Player"
                                )
                              }
                              title="Bump / Play Next"
                              className="p-1 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            >
                              <FastForward className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSwappingEntry(item)}
                              title="Swap position"
                              className="p-1 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAdminRemove(
                                  item.id,
                                  item.player?.full_name || item.player?.display_name || "Player"
                                )
                              }
                              title="Remove employee"
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Empty Paddle Slots */}
                  {Array.from({ length: 4 - pod.length }).map((_, emptyIdx) => (
                    <div
                      key={`empty-${emptyIdx}`}
                      className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-3 flex items-center justify-center text-center font-mono text-xs text-slate-400 dark:text-slate-500 min-h-[58px]"
                    >
                      <span>+ Waiting for Player {pod.length + emptyIdx + 1}</span>
                    </div>
                  ))}
                </div>

                {/* Balanced Matchup Preview when Rack is Full */}
                {isFull && matchup && (
                  <div className="rounded-xl border border-emerald-500/30 bg-slate-50 dark:bg-slate-950/90 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        PROJECTED PAIRING:
                      </span>
                      <span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                          {matchup.teamA.map((p) => p.full_name?.split(" ")[0]).join(" & ")}
                        </span>
                        {" vs "}
                        <span className="text-sky-700 dark:text-sky-300 font-bold">
                          {matchup.teamB.map((p) => p.full_name?.split(" ")[0]).join(" & ")}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                        ⚖️ {matchup.balanceScorePercent}% Balanced (Δ {matchup.ratingDelta.toFixed(2)})
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* Full List View */
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 divide-y divide-slate-200 dark:divide-slate-800/60 shadow-sm">
          {queue.map((item, index) => {
            const isMe = item.player_id === currentUserId;
            const isCalled = item.status === "called";
            const isGuest = item.player?.full_name?.includes("(Guest)");
            return (
              <div
                key={item.id || index}
                className={`p-4 flex items-center justify-between transition-colors ${
                  isCalled ? "bg-lime-50 dark:bg-[#d4e938]/5" : isMe ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.player?.full_name || item.player?.display_name || "Employee"}
                      </span>
                      {isMe && (
                        <Badge variant="volt" className="text-[9px] px-1 py-0">
                          YOU
                        </Badge>
                      )}
                      {isGuest && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase border-amber-500/30 text-amber-600 dark:text-amber-400">
                          GUEST
                        </Badge>
                      )}
                      {isCalled && (
                        <Badge variant="default" className="text-[9px] px-1 py-0 animate-pulse">
                          CALLED TO COURT
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Rating: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatRating(item.player?.skill_rating || 3.0)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right font-mono text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                    <span>Joined {new Date(item.joined_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleBump(
                            item.id,
                            item.player?.full_name || item.player?.display_name || "Player"
                          )
                        }
                        title="Bump / Play Next (still coming)"
                        className="h-8 px-2 text-xs font-mono text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      >
                        <FastForward className="h-3.5 w-3.5 mr-1" />
                        Play Next
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSwappingEntry(item)}
                        title="Swap spot or substitute coworker"
                        className="h-8 px-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                        Swap
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleAdminRemove(
                            item.id,
                            item.player?.full_name || item.player?.display_name || "Employee"
                          )
                        }
                        title="Remove employee from queue"
                        className="h-8 px-2 text-xs font-mono text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
