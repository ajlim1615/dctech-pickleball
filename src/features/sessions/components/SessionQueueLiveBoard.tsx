"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, X, CheckCircle2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useLiveQueue } from "@/features/queue/hooks/useLiveQueue";
import { previewMatchupFromPod, type MatchingStyle } from "@/features/queue/utils/matchingEngine";
import { joinQueue, leaveQueue, adminRemovePlayerFromQueue } from "@/features/queue/api/queueActions";
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

/** Styles where the real call-up shuffles players, so the teams shown are only a preview. */
const SHUFFLED_STYLES: MatchingStyle[] = ["social_mixer", "club_wars", "mixed_doubles"];

function styleLabel(style: MatchingStyle) {
  if (style === "fifo") return "First come, first served";
  const text = style.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function playerName(p?: Pick<Profile, "full_name" | "display_name"> | null) {
  return p?.full_name || p?.display_name || "Player";
}

// Stable default: a fresh [] each render would retrigger useLiveQueue's
// setQueue(initialQueue) effect forever.
const EMPTY_QUEUE: QueueEntryWithPlayer[] = [];

export function SessionQueueLiveBoard({
  initialQueue = EMPTY_QUEUE,
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

  // Chunk queue into 4-player groups
  const pods = useMemo(() => {
    const chunked: QueueEntryWithPlayer[][] = [];
    for (let i = 0; i < queue.length; i += 4) {
      chunked.push(queue.slice(i, i + 4));
    }
    return chunked;
  }, [queue]);

  const style = matchingMode || "balanced";
  const nextPod = useMemo(() => pods[0] || [], [pods]);
  const isNextPodFull = nextPod.length === 4;
  // Rendered on the server and the client, so it must be deterministic: seed on the queue entries.
  const nextMatchup = useMemo(() => {
    if (!isNextPodFull) return null;
    const profiles = nextPod.map((item) => ((item.player || item) as unknown) as Profile);
    return previewMatchupFromPod(profiles, style, nextPod.map((item) => item.id).join("|"));
  }, [isNextPodFull, nextPod, style]);
  const isPreviewOnly = SHUFFLED_STYLES.includes(style);

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

  async function handleAdminRemove(entryId: string, name: string) {
    if (!isAdmin || !sessionId) return;
    if (confirm(`Remove ${name} from queue?`)) {
      setIsSubmitting(true);
      await adminRemovePlayerFromQueue(sessionId, entryId);
      setIsSubmitting(false);
      router.refresh();
    }
  }

  const removeFor = (entry: QueueEntryWithPlayer | undefined, name: string) =>
    isAdmin && entry ? () => handleAdminRemove(entry.id, name) : undefined;

  return (
    <section
      aria-labelledby="queue-heading"
      className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-sm"
    >
      {/* Header: title, live counts, admin add */}
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id="queue-heading" className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Queue
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">{queue.length}</span> waiting
            {" · "}
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">{pods.length}</span>{" "}
            {pods.length === 1 ? "group" : "groups"}
            {" · "}
            {styleLabel(style)}
          </p>
        </div>

        {isAdmin && onOpenBulkQueue && (
          <Button
            type="button"
            variant="outline"
            onClick={onOpenBulkQueue}
            aria-label="Add players"
            className="h-11 min-w-11 shrink-0 px-3 font-semibold cursor-pointer"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Add players</span>
          </Button>
        )}
      </header>

      {/* Your place in line, or the join action */}
      {!readOnly && !isSystemAdmin && isSessionActive && (
        <div className="mx-4 mb-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 p-3">
          {isUserInQueue ? (
            showLeaveConfirm ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leave and lose your spot?</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowLeaveConfirm(false)} disabled={isSubmitting} className="h-11 cursor-pointer">
                    Stay
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleLeave} disabled={isSubmitting} className="h-11 font-semibold cursor-pointer">
                    {isSubmitting ? "Leaving…" : "Leave queue"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    You&apos;re <span className="font-mono tabular-nums">#{myPosition || 1}</span>
                    {myPosition && myPosition <= 4 ? " · up next" : " in line"}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowLeaveConfirm(true)}
                  disabled={isSubmitting}
                  className="h-11 px-3 font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  Leave
                </Button>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Ready for the next game?</p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="volt"
                  onClick={handleQuickJoinSolo}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  className="h-11 px-4 font-bold cursor-pointer"
                >
                  {!isSubmitting && <Plus className="h-4 w-4" />}
                  Join queue
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowJoinModal(true)}
                  disabled={isSubmitting}
                  aria-label="Join with a coworker or guest"
                  title="Join with a coworker or guest"
                  className="h-11 w-11 p-0 cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Up next: the first group of four */}
      <div className="px-4 pb-4">
        <div className="flex items-baseline justify-between gap-2 pb-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Up next</h3>
          {nextMatchup && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isPreviewOnly && "Preview · "}
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {nextMatchup.balanceScorePercent}%
              </span>{" "}
              balanced
            </span>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No one is in line yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The first four to join play next.</p>
          </div>
        ) : nextMatchup ? (
          <div className="space-y-2">
            <TeamBlock
              side="A"
              players={nextMatchup.teamA}
              avg={nextMatchup.teamARatingAvg}
              currentUserId={currentUserId}
              removeFor={(p) => removeFor(nextPod.find((item) => item.player_id === p.id), playerName(p))}
            />
            <TeamBlock
              side="B"
              players={nextMatchup.teamB}
              avg={nextMatchup.teamBRatingAvg}
              currentUserId={currentUserId}
              removeFor={(p) => removeFor(nextPod.find((item) => item.player_id === p.id), playerName(p))}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <ol className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
              {nextPod.map((item, idx) => (
                <QueueRow
                  key={item.id || idx}
                  position={idx + 1}
                  name={playerName(item.player)}
                  rating={item.player?.skill_rating}
                  isMe={item.player_id === currentUserId}
                  onRemove={removeFor(item, playerName(item.player))}
                />
              ))}
              {Array.from({ length: 4 - nextPod.length }).map((_, emptyIdx) => (
                <li key={`empty-${emptyIdx}`} className="flex min-h-11 items-center gap-3 px-3 text-sm text-slate-400 dark:text-slate-500">
                  <span className="w-5 text-right font-mono tabular-nums text-xs">{nextPod.length + emptyIdx + 1}</span>
                  Open spot
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Needs <span className="font-mono tabular-nums">{4 - nextPod.length}</span> more{" "}
              {4 - nextPod.length === 1 ? "player" : "players"} to make a game.
            </p>
          </div>
        )}
      </div>

      {/* Later groups */}
      {pods.length > 1 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pt-3 pb-4 space-y-3">
          {pods.slice(1).map((pod, i) => {
            const podIndex = i + 1;
            return (
              <div key={podIndex}>
                <div className="flex items-baseline justify-between gap-2 pb-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                    {podIndex === 1 ? "On deck" : `Group ${podIndex + 1}`}
                  </h3>
                  <span>
                    <span className="font-mono tabular-nums">{pod.length}/4</span>
                    {podIndex === 1 && " · about 12 min"}
                  </span>
                </div>
                <ol className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                  {pod.map((item, idx) => (
                    <QueueRow
                      key={item.id || idx}
                      position={podIndex * 4 + idx + 1}
                      name={playerName(item.player)}
                      rating={item.player?.skill_rating}
                      isMe={item.player_id === currentUserId}
                      onRemove={removeFor(item, playerName(item.player))}
                      muted
                    />
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}

      {/* Join with a coworker or guest */}
      <Modal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)}>
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl cursor-default">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Join the queue</h3>
            <button
              type="button"
              onClick={() => setShowJoinModal(false)}
              aria-label="Close"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleModalJoin} className="space-y-4">
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Join as</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {(["solo", "coworker", "guest"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setJoinMode(mode)}
                    aria-pressed={joinMode === mode}
                    className={`h-11 rounded-lg border text-sm font-semibold capitalize cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                      joinMode === mode
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </fieldset>

            {joinMode === "coworker" && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Partner</span>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Choose a coworker</option>
                  {employees
                    .filter((e) => e.id !== currentUserId && e.email?.toLowerCase() !== "admin@dctechmicro.com")
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {playerName(emp)} ({formatRating(emp.skill_rating)})
                      </option>
                    ))}
                </select>
              </label>
            )}

            {joinMode === "guest" && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Guest name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowJoinModal(false)} className="h-11 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" variant="volt" disabled={isSubmitting} className="h-11 font-bold cursor-pointer">
                {isSubmitting ? "Joining…" : "Join queue"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </section>
  );
}

function TeamBlock({
  side,
  players,
  avg,
  currentUserId,
  removeFor,
}: {
  side: "A" | "B";
  players: Profile[];
  avg: number;
  currentUserId: string;
  removeFor: (p: Profile) => (() => void) | undefined;
}) {
  const isA = side === "A";
  const label = isA ? "Team 1" : "Team 2";
  return (
    <div
      className={`rounded-xl border-l-4 ${
        isA
          ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/25"
          : "border-sky-500 bg-sky-50/70 dark:bg-sky-950/25"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 px-3 pt-2.5 text-xs">
        <span className={`font-semibold ${isA ? "text-emerald-700 dark:text-emerald-400" : "text-sky-700 dark:text-sky-400"}`}>
          {label}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          avg <span className="font-mono tabular-nums">{avg.toFixed(2)}</span>
        </span>
      </div>
      <ul className="pb-1">
        {players.map((p) => (
          <PlayerLine
            key={p.id}
            name={playerName(p)}
            rating={p.skill_rating}
            isMe={p.id === currentUserId}
            onRemove={removeFor(p)}
          />
        ))}
      </ul>
    </div>
  );
}

function QueueRow({
  position,
  muted,
  ...rest
}: {
  position: number;
  name: string;
  rating?: number | null;
  isMe: boolean;
  onRemove?: () => void;
  muted?: boolean;
}) {
  return (
    <PlayerLine
      {...rest}
      muted={muted}
      leading={
        <span className="w-5 shrink-0 text-right font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500">
          {position}
        </span>
      }
    />
  );
}

function PlayerLine({
  name,
  rating,
  isMe,
  onRemove,
  leading,
  muted,
}: {
  name: string;
  rating?: number | null;
  isMe: boolean;
  onRemove?: () => void;
  leading?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li className={`flex min-h-11 items-center gap-3 ${onRemove ? "pl-3 pr-0" : "px-3"}`}>
      {leading}
      <span
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
          muted ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {name}
        {isMe && (
          <span className="ml-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            You
          </span>
        )}
      </span>
      <span className="shrink-0 font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
        {formatRating(rating ?? 3.0)}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name} from the queue`}
          title="Remove from queue"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
