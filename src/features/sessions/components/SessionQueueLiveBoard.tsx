"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Swords,
  Sparkles,
  Zap,
  Plus,
  UserCheck,
  UserPlus,
  FastForward,
  ArrowLeftRight,
  X,
  ExternalLink,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Check,
  Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useLiveQueue } from "@/features/queue/hooks/useLiveQueue";
import { createMatchupFromPod, type MatchingStyle } from "@/features/queue/utils/matchingEngine";
import {
  joinQueue,
  leaveQueue,
  bumpPlayerInQueue,
  adminRemovePlayerFromQueue,
  swapQueuePlayers,
  bulkAddPlayersToQueue,
} from "@/features/queue/api/queueActions";
import { createWalkInPlayer } from "@/features/admin/api/adminActions";
import { formatRating } from "@/lib/utils";
import type { QueueEntryWithPlayer, Profile } from "@/types";

interface SessionQueueLiveBoardProps {
  initialQueue?: QueueEntryWithPlayer[];
  sessionId: string;
  currentUserId?: string;
  userRole?: string;
  userEmail?: string;
  employees?: Profile[];
  isSessionActive?: boolean;
  onOpenBulkQueue?: () => void;
  readOnly?: boolean;
  matchingMode?: MatchingStyle;
}

export function SessionQueueLiveBoard({
  initialQueue = [],
  sessionId,
  currentUserId = "",
  userRole = "player",
  userEmail = "",
  employees = [],
  isSessionActive = true,
  onOpenBulkQueue,
  readOnly = false,
  matchingMode = "balanced",
}: SessionQueueLiveBoardProps) {
  const router = useRouter();
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = !readOnly && (userRole === "admin" || isSystemAdmin);

  const { queue, myPosition } = useLiveQueue(initialQueue, currentUserId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [joinMode, setJoinMode] = useState<"solo" | "coworker" | "guest">("solo");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [guestName, setGuestName] = useState("");

  const isUserInQueue = useMemo(
    () => queue.some((q) => q.player_id === currentUserId),
    [queue, currentUserId]
  );

  // Chunk queue into 4-player match pods
  const pods = useMemo(() => {
    const chunked: QueueEntryWithPlayer[][] = [];
    for (let i = 0; i < queue.length; i += 4) {
      chunked.push(queue.slice(i, i + 4));
    }
    return chunked;
  }, [queue]);

  const nextPod = pods[0] || [];
  const isNextPodFull = nextPod.length === 4;
  const nextMatchup = useMemo(() => {
    if (!isNextPodFull) return null;
    const nextPodProfiles: Profile[] = nextPod.map(
      (item) => ((item.player || item) as unknown) as Profile
    );
    return createMatchupFromPod(nextPodProfiles, matchingMode || "balanced");
  }, [isNextPodFull, nextPod, matchingMode]);

  async function handleQuickJoinSolo() {
    if (!sessionId || isSystemAdmin || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await joinQueue({ sessionId });
      if (res?.error) {
        alert(`Error joining queue: ${res.error}`);
      } else {
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleModalJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || isSystemAdmin || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await joinQueue({
        sessionId,
        partnerId: joinMode === "coworker" && selectedPartnerId ? selectedPartnerId : undefined,
        guestName: joinMode === "guest" && guestName ? guestName : undefined,
      });
      if (res?.error) {
        alert(`Error joining queue: ${res.error}`);
      } else {
        setShowJoinModal(false);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLeave() {
    if (!sessionId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await leaveQueue(sessionId);
      setShowLeaveConfirm(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBump(entryId: string, name: string) {
    if (!isAdmin || !sessionId) return;
    setIsSubmitting(true);
    await bumpPlayerInQueue(sessionId, entryId);
    setIsSubmitting(false);
    router.refresh();
  }

  async function handleAdminRemove(entryId: string, name: string) {
    if (!isAdmin || !sessionId) return;
    if (confirm(`Remove ${name} from queue?`)) {
      setIsSubmitting(true);
      await adminRemovePlayerFromQueue(sessionId, entryId);
      setIsSubmitting(false);
      router.refresh();
    }
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm overflow-hidden space-y-4 p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Live Paddle Queue
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </CardTitle>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>{queue.length} Queued • {pods.length} Rack{pods.length !== 1 ? "s" : ""}</span>
              {matchingMode && (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 text-[9px] uppercase font-bold border border-slate-200 dark:border-slate-700">
                  {matchingMode.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && onOpenBulkQueue && (
            <Button
              type="button"
              variant="volt"
              size="sm"
              onClick={onOpenBulkQueue}
              className="text-xs h-7 px-2.5 font-bold shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Bulk Queue</span>
            </Button>
          )}
        </div>
      </div>

      {/* User Queue Status & Join Actions */}
      {!readOnly && !isSystemAdmin && isSessionActive && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 flex items-center justify-between gap-3 text-xs font-mono">
          {isUserInQueue ? (
            <>
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  You are #{myPosition || 1} in queue {myPosition && myPosition <= 4 ? "(Up Next!)" : ""}
                </span>
              </div>
              {showLeaveConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-semibold">
                    Lose your spot?
                  </span>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-2 py-1 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "Leaving..." : "Yes, Leave"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeaveConfirm(false)}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLeaveConfirm(true)}
                  disabled={isSubmitting}
                  className="text-[11px] h-7 px-2 text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Leave Queue
                </Button>
              )}
            </>
          ) : (
            <>
              <span className="text-slate-600 dark:text-slate-400">Ready for next rotation?</span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="volt"
                  size="sm"
                  onClick={handleQuickJoinSolo}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  className="font-bold text-xs h-8 px-3 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Join (Solo)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowJoinModal(true)}
                  disabled={isSubmitting}
                  className="text-xs h-8 px-2.5 text-slate-700 dark:text-slate-300"
                  title="Join with coworker partner or guest"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* RACK #1: UP NEXT STADIUM HERO */}
      <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="volt" className="text-[9px] font-mono font-extrabold uppercase px-1.5 py-0">
              🔥 RACK #1 • NEXT GAME
            </Badge>
          </div>
          {nextMatchup && (
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              ⚖️ {nextMatchup.balanceScorePercent}% Balanced
            </span>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="py-4 text-center space-y-1 font-mono text-xs text-slate-400">
            <div>No players currently in line.</div>
            <div className="text-[11px] text-slate-500">Join the queue to start the next rotation!</div>
          </div>
        ) : isNextPodFull && nextMatchup ? (
          /* Full 2v2 Teams with Player Names */
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {/* Team 1 */}
              <div className="rounded-lg border border-emerald-500/30 bg-white dark:bg-slate-900/90 p-2.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>TEAM 1</span>
                  <span>Avg {nextMatchup.teamARatingAvg.toFixed(2)}</span>
                </div>
                <div className="space-y-1.5">
                  {nextMatchup.teamA.map((p, idx) => {
                    const isMe = p.id === currentUserId;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {p.full_name || p.display_name} {isMe && "(YOU)"}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRating(p.skill_rating)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team 2 */}
              <div className="rounded-lg border border-sky-500/30 bg-white dark:bg-slate-900/90 p-2.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-bold text-sky-700 dark:text-sky-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                  <span>TEAM 2</span>
                  <span>Avg {nextMatchup.teamBRatingAvg.toFixed(2)}</span>
                </div>
                <div className="space-y-1.5">
                  {nextMatchup.teamB.map((p, idx) => {
                    const isMe = p.id === currentUserId;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {p.full_name || p.display_name} {isMe && "(YOU)"}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRating(p.skill_rating)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-950/50 rounded-md p-1.5 text-center flex items-center justify-center gap-1 font-semibold">
              <Zap className="h-3 w-3 text-emerald-600" />
              <span>
                {nextMatchup.teamA.map(p => p.full_name?.split(" ")[0]).join(" & ")} vs {nextMatchup.teamB.map(p => p.full_name?.split(" ")[0]).join(" & ")}
              </span>
            </div>
          </div>
        ) : (
          /* Partial Pod (< 4 players) */
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {nextPod.map((item, idx) => {
                const isMe = item.player_id === currentUserId;
                return (
                  <div
                    key={item.id || idx}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-2 text-xs font-mono flex items-center justify-between"
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      #{idx + 1} {item.player?.full_name?.split(" ")[0] || "Player"} {isMe && "(YOU)"}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatRating(item.player?.skill_rating || 3.0)}
                    </span>
                  </div>
                );
              })}

              {Array.from({ length: 4 - nextPod.length }).map((_, emptyIdx) => (
                <div
                  key={`empty-${emptyIdx}`}
                  className="rounded-lg border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 text-center text-[10px] font-mono text-slate-400"
                >
                  + Slot #{nextPod.length + emptyIdx + 1} Empty
                </div>
              ))}
            </div>

            <div className="text-[10px] font-mono text-slate-500 text-center">
              Waiting for {4 - nextPod.length} more player{4 - nextPod.length > 1 ? "s" : ""} to complete matchup.
            </div>
          </div>
        )}
      </div>

      {/* RACK #2 & ON DECK (If more players queued) */}
      {pods.length > 1 && (
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
            <span>RACK #2 • ON DECK ({pods[1].length}/4)</span>
            <span className="text-slate-400 font-normal">Est. ~12m</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {pods[1].map((item, idx) => (
              <div
                key={item.id || idx}
                className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 px-2 py-1 text-[11px] font-mono flex items-center justify-between"
              >
                <span className="text-slate-800 dark:text-slate-200 truncate">
                  #{idx + 5} {item.player?.full_name?.split(" ")[0] || "Player"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatRating(item.player?.skill_rating || 3.0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for Joining with Partner / Guest */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      >
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl font-mono text-xs cursor-default">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Join Paddle Queue
              </h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleModalJoin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-slate-600 dark:text-slate-400">Mode</label>
                <div className="grid grid-cols-3 gap-1">
                  {(["solo", "coworker", "guest"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setJoinMode(mode)}
                      className={`py-1.5 px-2 rounded-lg border text-center capitalize text-[11px] font-bold ${
                        joinMode === mode
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {joinMode === "coworker" && (
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Select Coworker</label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Choose Colleague --</option>
                    {employees
                      .filter((e) => e.id !== currentUserId && e.email?.toLowerCase() !== "admin@dctechmicro.com")
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name || emp.display_name} (DUPR {formatRating(emp.skill_rating)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {joinMode === "guest" && (
                <div className="space-y-1">
                  <label className="text-slate-600 dark:text-slate-400">Guest Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jordan (Guest)"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="volt"
                  size="sm"
                  disabled={isSubmitting}
                  className="font-bold"
                >
                  Confirm & Enter
                </Button>
              </div>
            </form>
          </div>
      </Modal>
    </Card>
  );
}
