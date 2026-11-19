"use client";

import { useState, useMemo } from "react";
import { Plus, UserPlus, X, CheckCircle2, Users, Coffee, UserMinus, Shuffle, HelpCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { WaitTimer } from "@/components/ui/wait-timer";
import { useLiveQueue } from "@/features/queue/hooks/useLiveQueue";
import {
  decide,
  isRotationStyle,
  seededRandom,
  teamStats,
  DEFAULT_SKILL_SPREAD,
  type MatchingStyle,
  type PastGame,
} from "@/features/queue/matchmaking";
import { previewCourtId } from "@/features/queue/api/matchmakingData";
import { joinQueue, adminRemovePlayerFromQueue, setQueueBreak } from "@/features/queue/api/queueActions";
import { QueueCallupAlert, requestCallupNotifications } from "@/features/queue/components/QueueCallupAlert";
import { formatRating } from "@/lib/utils";
import type { ActiveCourtView, QueueEntryWithPlayer, Profile, SessionEvent } from "@/types";
import type { UpNextCard } from "@/features/queue/upNext/types";
import { WaitCard } from "@/features/activity/components/WaitCard";
import {
  NO_LIMITS_USED,
  canRejoin,
  SELF_BREAKS_ENABLED,
  canTakeBreak as breakAllowed,
  type QueueLimits,
} from "@/features/queue/utils/queueLimits";

interface SessionQueueLiveBoardProps {
  initialQueue?: QueueEntryWithPlayer[];
  sessionId: string;
  currentUserId?: string;
  userRole?: string;
  userEmail?: string;
  employees?: Profile[];
  isSessionActive?: boolean;
  /** Not started yet: no joining; everyone going is shuffled into the line at the start. */
  isSessionScheduled?: boolean;
  onOpenBulkQueue?: () => void;
  readOnly?: boolean;
  matchingMode?: MatchingStyle;
  /** Courts in this session, to name the court in "You're up" and spot a player who is on court. */
  courts?: ActiveCourtView[];
  /** Session activity for the "Why the wait?" card. */
  activity?: { events: SessionEvent[]; names: Record<string, string>; avgGameMinutes: number | null };
  /** This session's finished games, so the Up next preview avoids repeats like the real call-up. */
  history?: PastGame[];
  /** Biggest rating gap allowed within a group for Skill Separated. */
  skillSpread?: number;
  /** The admin allowed joining with a partner (coworker or guest) for this session. */
  allowPartners?: boolean;
  /** Breaks and leaves the signed-in player used this session (one break, one rejoin). */
  queueLimits?: QueueLimits;
  /** Completed games played per player in this session. */
  gamesPlayed?: Record<string, number>;
  /** Session check-in timestamps per player (ISO strings). */
  arrivedAtByPlayer?: Record<string, string>;
  /** Check yourself out (same as the session's Check out). Shown while self breaks are paused. */
  onCheckOut?: () => void;
  checkingOut?: boolean;
  /** The real Up Next 1 card. When set, "Up next" shows it instead of working out its own preview. */
  upNextCard?: UpNextCard;
}

/** How many later groups show before "Show everyone in line". */
const GROUPS_SHOWN = 2;

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

function matchingSummaryFor(style: MatchingStyle) {
  if (isRotationStyle(style)) {
    return (
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <strong className="font-semibold text-slate-800 dark:text-slate-100">#1 in line always plays next</strong> — waiting longest guarantees your spot.
        </li>
        <li>
          <strong className="font-semibold text-slate-800 dark:text-slate-100">Fair game pace:</strong> Among the top 8 waiting, players who have played fewer games since arriving get a gentle nudge so faster vs. slower games stay even.
        </li>
        <li>
          <strong className="font-semibold text-slate-800 dark:text-slate-100">Late arrivals stay fair:</strong> Joining later starts neutral (it won&apos;t jump you ahead of players who arrived earlier), while ratings and fresh partners are still balanced.
        </li>
      </ul>
    );
  }
  switch (style) {
    case "fifo":
      return (
        <p>
          Players are called in strict first-in, first-out order. The first 2 waiting play against the next 2 in line.
        </p>
      );
    case "king_queen":
      return (
        <p>
          Winning pairs hold or move up toward the top court while challengers rotate in from the line and split pairings.
        </p>
      );
    case "winners_stay":
      return (
        <p>
          Previous winners stay on court and split against incoming challengers from the front of the line.
        </p>
      );
    case "winners_losers":
      return (
        <p>
          Players are grouped by their last result—winners play winners and losers play losers—reaching down the line as needed to form a match.
        </p>
      );
    default:
      return <p>Players are matched from the front of the line according to this session&apos;s rotation rules.</p>;
  }
}

// Stable default: a fresh [] each render would retrigger useLiveQueue's
// setQueue(initialQueue) effect forever.
const EMPTY_QUEUE: QueueEntryWithPlayer[] = [];
const EMPTY_COURTS: ActiveCourtView[] = [];
const EMPTY_HISTORY: PastGame[] = [];
const EMPTY_ARRIVALS: Record<string, string> = {};
const EMPTY_GAMES_PLAYED: Record<string, number> = {};

const courtLabel = (court?: Pick<ActiveCourtView, "name"> | null) =>
  court?.name.replace(/\s*\(Rented Court\)/i, "") || undefined;

export function SessionQueueLiveBoard({
  initialQueue = EMPTY_QUEUE,
  sessionId,
  currentUserId = "",
  userRole = "player",
  userEmail = "",
  employees = [],
  isSessionActive = true,
  isSessionScheduled = false,
  onOpenBulkQueue,
  onCheckOut,
  checkingOut = false,
  upNextCard,
  readOnly = false,
  matchingMode = "balanced",
  courts = EMPTY_COURTS,
  activity,
  history = EMPTY_HISTORY,
  skillSpread = DEFAULT_SKILL_SPREAD,
  allowPartners = false,
  queueLimits = NO_LIMITS_USED,
  gamesPlayed = EMPTY_GAMES_PLAYED,
  arrivedAtByPlayer = EMPTY_ARRIVALS,
}: SessionQueueLiveBoardProps) {
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = !readOnly && (userRole === "admin" || isSystemAdmin);

  const { queue: allEntries, myPosition, calledAlert, dismissAlert } = useLiveQueue(initialQueue, currentUserId, sessionId);
  // Players on a break keep their entry (and place) but are not in line.
  const queue = useMemo(() => allEntries.filter((q) => q.status !== "on_break"), [allEntries]);
  const onBreak = useMemo(() => allEntries.filter((q) => q.status === "on_break"), [allEntries]);
  const myEntry = allEntries.find((q) => q.player_id === currentUserId);
  const isMeOnBreak = myEntry?.status === "on_break";
  const myCourt = useMemo(
    () =>
      currentUserId
        ? courts.find((c) =>
            c.current_match?.status === "in_progress" &&
            c.current_match.players?.some((p) => p.player_id === currentUserId)
          )
        : undefined,
    [courts, currentUserId]
  );
  const calledCourtName = calledAlert ? courtLabel(courts.find((c) => c.id === calledAlert.courtId)) : undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showMatchingInfo, setShowMatchingInfo] = useState(false);
  const [joinMode, setJoinMode] = useState<"solo" | "coworker" | "guest">("solo");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [guestName, setGuestName] = useState("");
  // One break per session: true once taken, before the refreshed page confirms it.
  const [tookBreak, setTookBreak] = useState(false);
  const canTakeBreak = breakAllowed(queueLimits) && !tookBreak;
  const canJoinAgain = canRejoin(queueLimits);

  const isUserInQueue = Boolean(myEntry);
  const joinedAtByPlayerId = useMemo(
    () => new Map(queue.map((q) => [q.player_id, q.joined_at])),
    [queue]
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
  // Rendered on the server and the client, so it must be deterministic: seed on the queue entries.
  const preview = useMemo(() => {
    const target = previewCourtId(courts);
    // Same line as the real call-up: waiting only, oldest first, the whole line.
    const callLine = queue
      .filter((q) => q.status === "waiting")
      .sort((a, b) => (a.joined_at < b.joined_at ? -1 : a.joined_at > b.joined_at ? 1 : 0));
    if (!target || callLine.length < 4) return null;
    const decision = decide({
      style,
      line: callLine.map((q) => ({
        playerId: q.player_id,
        rating: q.player?.skill_rating ?? null,
        pairId: q.group_id,
        arrivedAt: arrivedAtByPlayer?.[q.player_id] ?? q.joined_at,
      })),
      history,
      court: target.court,
      courts: target.courts,
      settings: { skillSpread },
      random: seededRandom(callLine.map((q) => q.id).join("|")),
    });
    if (!("teamA" in decision)) return { hold: decision.hold };
    const byId = new Map(callLine.map((q) => [q.player_id, q]));
    const ratingOf = (id: string) => byId.get(id)?.player?.skill_rating ?? 2.0;
    const profilesOf = (ids: string[]) =>
      ids.map((id) => ((byId.get(id)?.player ?? byId.get(id)) as unknown) as Profile);
    return {
      hold: null,
      teamA: profilesOf(decision.teamA),
      teamB: profilesOf(decision.teamB),
      ...teamStats(decision, ratingOf),
    };
  }, [courts, queue, history, skillSpread, style, arrivedAtByPlayer]);
  // A live session with Up Next cards shows the real Up Next 1, so this panel and the
  // cards always agree on who plays next.
  const realNext = useMemo(() => {
    if (!isSessionActive || !upNextCard) return null;
    const byId = new Map(queue.map((q) => [q.player_id, q]));
    const profileOf = (id: string) =>
      (byId.get(id)?.player ?? { id, full_name: upNextCard.names[id] ?? "Player", skill_rating: null }) as Profile;
    const ratingOf = (id: string) => byId.get(id)?.player?.skill_rating ?? 2.0;
    return {
      position: upNextCard.position,
      ids: new Set([...upNextCard.teamA, ...upNextCard.teamB]),
      teamA: upNextCard.teamA.map(profileOf),
      teamB: upNextCard.teamB.map(profileOf),
      ...teamStats(upNextCard, ratingOf),
    };
  }, [isSessionActive, upNextCard, queue]);

  const nextMatchup = realNext ?? (preview && preview.hold === null ? preview : null);
  const waitingForSkillMatch = !realNext && preview?.hold === "no_skill_match";
  const isPreviewOnly = !realNext && SHUFFLED_STYLES.includes(style);

  // Everyone else in line, in groups of four, numbered by their real place in line.
  const placeInLine = useMemo(() => new Map(queue.map((q, i) => [q.id, i + 1])), [queue]);
  const laterPods = useMemo(() => {
    if (!realNext) return pods.slice(1);
    const rest = queue.filter((q) => !realNext.ids.has(q.player_id));
    const chunked: QueueEntryWithPlayer[][] = [];
    for (let i = 0; i < rest.length; i += 4) chunked.push(rest.slice(i, i + 4));
    return chunked;
  }, [realNext, pods, queue]);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const shownPods = showAllGroups ? laterPods : laterPods.slice(0, GROUPS_SHOWN);
  const hiddenPlayers = laterPods.slice(GROUPS_SHOWN).reduce((n, pod) => n + pod.length, 0);

  async function handleQuickJoinSolo() {
    if (!sessionId || isSystemAdmin || isSubmitting) return;
    requestCallupNotifications();
    setIsSubmitting(true);
    try {
      const res = await joinQueue({ sessionId });
      if (res?.error) {
        alert(`Error joining queue: ${res.error}`);
      } else {
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleModalJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || isSystemAdmin || isSubmitting) return;
    requestCallupNotifications();
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
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBreak(takeBreak: boolean) {
    if (!sessionId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await setQueueBreak(sessionId, takeBreak);
      if (res?.error) {
        alert(res.error);
        if (takeBreak && res.error.includes("used your break")) setTookBreak(true);
      } else {
        if (takeBreak) setTookBreak(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const [pendingRemove, setPendingRemove] = useState<{ entryId: string; name: string } | null>(null);

  async function handleConfirmAdminRemove(alsoCheckOut: boolean) {
    if (!isAdmin || !sessionId || !pendingRemove || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await adminRemovePlayerFromQueue(sessionId, pendingRemove.entryId, alsoCheckOut);
      setPendingRemove(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  const removeFor = (entry: QueueEntryWithPlayer | undefined, name: string) =>
    isAdmin && entry ? () => setPendingRemove({ entryId: entry.id, name }) : undefined;

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
          <button
            type="button"
            onClick={() => setShowMatchingInfo((v) => !v)}
            aria-expanded={showMatchingInfo}
            aria-controls="how-matching-works-panel"
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500 rounded-md"
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span>How matching works</span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${showMatchingInfo ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>

        {isAdmin && onOpenBulkQueue && isSessionActive && !isSessionScheduled && (
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

      {showMatchingInfo && (
        <div
          id="how-matching-works-panel"
          className="mx-4 mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1.5"
        >
          {matchingSummaryFor(style)}
        </div>
      )}

      {calledAlert && <QueueCallupAlert courtName={calledCourtName} onAcknowledge={dismissAlert} />}

      {/* Your status: on court, on a break, in line, or not in line yet */}
      {!readOnly && !isSystemAdmin && (isSessionActive || isSessionScheduled) && (
        <div className="mx-4 mb-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 p-3">
          {myCourt ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              You&apos;re playing on {courtLabel(myCourt)}. You rejoin the line after the game.
            </p>
          ) : isUserInQueue ? (
            isMeOnBreak ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  <Coffee className="h-4 w-4 shrink-0" />
                  On a break. Your place is saved.
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="volt"
                    onClick={() => handleBreak(false)}
                    disabled={isSubmitting}
                    className="h-11 px-4 font-bold cursor-pointer"
                  >
                    {isSubmitting ? "Saving…" : "I'm back"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    You&apos;re <span className="font-mono tabular-nums">#{myPosition || 1}</span>
                    {isSessionScheduled
                      ? " in line for now · the line is shuffled when the session starts"
                      : myPosition && myPosition <= 4 ? " · up next" : " in line"}
                  </span>
                </p>
                <div className="flex gap-1">
                  {/* Take a break is paused (SELF_BREAKS_ENABLED); Check out stands in for it. */}
                  {!SELF_BREAKS_ENABLED && onCheckOut && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCheckOut}
                      disabled={isSubmitting || checkingOut}
                      title="Check out of this session and leave the line"
                      className="h-11 px-3 font-semibold cursor-pointer"
                    >
                      <UserMinus className="h-4 w-4 mr-1.5" />
                      {checkingOut ? "Checking out…" : "Check out"}
                    </Button>
                  )}
                  {SELF_BREAKS_ENABLED && canTakeBreak && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleBreak(true)}
                      disabled={isSubmitting}
                      title="Skip games until you're back, without losing your place. One break per session."
                      className="h-11 px-3 font-semibold cursor-pointer"
                    >
                      <Coffee className="h-4 w-4 mr-1.5" />
                      Take a break
                    </Button>
                  )}
                </div>
                {SELF_BREAKS_ENABLED && !canTakeBreak && !isSessionScheduled && (
                  <p className="basis-full flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Coffee className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    You&apos;ve used your break for this session.
                  </p>
                )}
                {activity && currentUserId && (
                  <div className="basis-full">
                    <WaitCard
                      position={myPosition}
                      courtsInPlay={courts.filter((c) => c.status === "occupied").length}
                      avgGameMinutes={activity.avgGameMinutes}
                      events={activity.events}
                      names={activity.names}
                      viewerId={currentUserId}
                      gamesPlayed={gamesPlayed[currentUserId] ?? 0}
                    />
                  </div>
                )}
              </div>
            )
          ) : isSessionScheduled ? (
            // No pre-queue: the starting line is shuffled from everyone going when the session starts.
            <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Shuffle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                Tap <span className="font-semibold text-slate-900 dark:text-slate-100">I&apos;m going</span> to be in the line.
                When the session starts, everyone going is shuffled into the line, then the game mode picks each match.
              </span>
            </p>
          ) : !canJoinAgain ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You&apos;ve left the line twice this session. Ask an admin if you want to play again.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {queueLimits.timesLeft > 0 ? "Coming back? You can rejoin once, at the back of the line." : "Ready for the next game?"}
              </p>
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
                {allowPartners && (
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
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Up next: the first group of four */}
      <div className="px-4 pb-4">
        <div className="flex items-baseline justify-between gap-2 pb-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Up next
            {realNext && (
              <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">· Up Next {realNext.position}</span>
            )}
          </h3>
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
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isSessionScheduled
                ? "The line is built from everyone going when the session starts."
                : "The first four to join play next."}
            </p>
          </div>
        ) : nextMatchup ? (
          <div className="space-y-2">
            <TeamBlock
              side="A"
              players={nextMatchup.teamA}
              avg={nextMatchup.teamARatingAvg}
              currentUserId={currentUserId}
              removeFor={(p) => removeFor(queue.find((item) => item.player_id === p.id), playerName(p))}
              gamesPlayed={gamesPlayed}
              joinedAtByPlayerId={joinedAtByPlayerId}
              showWait={isSessionActive}
            />
            <TeamBlock
              side="B"
              players={nextMatchup.teamB}
              avg={nextMatchup.teamBRatingAvg}
              currentUserId={currentUserId}
              removeFor={(p) => removeFor(queue.find((item) => item.player_id === p.id), playerName(p))}
              gamesPlayed={gamesPlayed}
              joinedAtByPlayerId={joinedAtByPlayerId}
              showWait={isSessionActive}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {waitingForSkillMatch && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Waiting for a skill match</p>
            )}
            <ol className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
              {nextPod.map((item, idx) => (
                <QueueRow
                  key={item.id || idx}
                  position={idx + 1}
                  name={playerName(item.player)}
                  rating={item.player?.skill_rating}
                  isMe={item.player_id === currentUserId}
                  onRemove={removeFor(item, playerName(item.player))}
                  gamesCount={gamesPlayed[item.player_id] ?? 0}
                  joinedAt={item.joined_at}
                  showWait={isSessionActive}
                />
              ))}
              {Array.from({ length: 4 - nextPod.length }).map((_, emptyIdx) => (
                <li key={`empty-${emptyIdx}`} className="flex min-h-11 items-center gap-3 px-3 text-sm text-slate-400 dark:text-slate-500">
                  <span className="w-5 text-right font-mono tabular-nums text-xs">{nextPod.length + emptyIdx + 1}</span>
                  Open spot
                </li>
              ))}
            </ol>
            {nextPod.length < 4 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Needs <span className="font-mono tabular-nums">{4 - nextPod.length}</span> more{" "}
                {4 - nextPod.length === 1 ? "player" : "players"} to make a game.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Later groups: the next few, then the rest behind "Show everyone in line" */}
      {laterPods.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pt-3 pb-4 space-y-3">
          {shownPods.map((pod, i) => {
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
                      position={placeInLine.get(item.id) ?? podIndex * 4 + idx + 1}
                      name={playerName(item.player)}
                      rating={item.player?.skill_rating}
                      isMe={item.player_id === currentUserId}
                      onRemove={removeFor(item, playerName(item.player))}
                      gamesCount={gamesPlayed[item.player_id] ?? 0}
                      joinedAt={item.joined_at}
                      showWait={isSessionActive}
                      muted
                    />
                  ))}
                </ol>
              </div>
            );
          })}
          {hiddenPlayers > 0 && (
            <button
              type="button"
              onClick={() => setShowAllGroups((v) => !v)}
              aria-expanded={showAllGroups}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              {showAllGroups ? "Show fewer" : `Show everyone in line (${hiddenPlayers} more)`}
              <ChevronDown className={`h-4 w-4 transition-transform ${showAllGroups ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}

      {/* Players on a break: their place is saved, they're skipped until they return */}
      {onBreak.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pt-3 pb-4">
          <h3 className="flex items-center gap-1.5 pb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Coffee className="h-3.5 w-3.5 text-amber-500" />
            On a break ({onBreak.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {onBreak.map((item) => (
              <li
                key={item.id}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  item.player_id === currentUserId
                    ? "border-amber-500/50 text-amber-700 dark:text-amber-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}
              >
                {playerName(item.player)}
                {item.player_id === currentUserId && " (you)"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Join with a coworker or guest */}
      <Modal isOpen={showJoinModal && allowPartners} onClose={() => setShowJoinModal(false)}>
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

      {/* Admin: Remove from line vs Check out */}
      <Modal
        isOpen={pendingRemove !== null}
        onClose={() => {
          if (!isSubmitting) setPendingRemove(null);
        }}
      >
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl cursor-default">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Remove {pendingRemove?.name}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose whether they are just stepping out of line or leaving the session.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !isSubmitting && setPendingRemove(null)}
              aria-label="Close"
              className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleConfirmAdminRemove(false)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2.5 text-left transition-colors disabled:opacity-50 cursor-pointer"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Remove from line only
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Takes them out of the queue; they stay checked in.
              </div>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleConfirmAdminRemove(true)}
              className="w-full rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/50 px-3.5 py-2.5 text-left transition-colors disabled:opacity-50 cursor-pointer"
            >
              <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Check out of session
              </div>
              <div className="text-xs text-rose-600/80 dark:text-rose-400/80">
                Removes them from the queue and checks them out of attendance.
              </div>
            </button>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => setPendingRemove(null)}
              className="h-9 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
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
  gamesPlayed,
  joinedAtByPlayerId,
  showWait,
}: {
  side: "A" | "B";
  players: Profile[];
  avg: number;
  currentUserId: string;
  removeFor: (p: Profile) => (() => void) | undefined;
  gamesPlayed: Record<string, number>;
  joinedAtByPlayerId: Map<string, string>;
  showWait: boolean;
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
            gamesCount={gamesPlayed[p.id] ?? 0}
            joinedAt={joinedAtByPlayerId.get(p.id)}
            showWait={showWait}
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
  gamesCount?: number;
  joinedAt?: string | null;
  showWait?: boolean;
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
  gamesCount,
  joinedAt,
  showWait,
}: {
  name: string;
  rating?: number | null;
  isMe: boolean;
  onRemove?: () => void;
  leading?: React.ReactNode;
  muted?: boolean;
  gamesCount?: number;
  joinedAt?: string | null;
  showWait?: boolean;
}) {
  const showGames = gamesCount !== undefined && (showWait || gamesCount > 0);
  const showTimer = Boolean(showWait && joinedAt);
  const showMeta = showGames || showTimer;

  // Admins tap the name to remove or check out (no x on every row, so a stray tap can't hit it).
  const NameTag = onRemove ? "button" : "div";
  return (
    <li className="flex min-h-11 items-center gap-3 px-3">
      {leading}
      <NameTag
        {...(onRemove
          ? {
              type: "button" as const,
              onClick: onRemove,
              title: `Remove or check out ${name}`,
              "aria-label": `${name}: remove or check out`,
            }
          : {})}
        className={`min-w-0 flex-1 py-1.5 text-left ${
          onRemove
            ? "group cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-emerald-500"
            : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`block truncate text-sm font-medium underline-offset-2 ${onRemove ? "group-hover:underline" : ""} ${
              muted ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {name}
          </span>
          {isMe && (
            <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              You
            </span>
          )}
        </div>
        {showMeta && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {showGames && (
              <span className="tabular-nums">
                {gamesCount} {gamesCount === 1 ? "game" : "games"}
              </span>
            )}
            {showTimer && joinedAt && (
              <>
                {showGames && <span aria-hidden>·</span>}
                <WaitTimer since={joinedAt} />
              </>
            )}
          </div>
        )}
      </NameTag>
      <span className="shrink-0 font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
        {formatRating(rating ?? 2.0)}
      </span>
    </li>
  );
}
