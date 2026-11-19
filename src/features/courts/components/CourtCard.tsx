"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { Trophy, CheckCircle2, Zap, RotateCcw, AlertCircle, ShieldCheck, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useSharedNow } from "@/components/ui/wait-timer";
import { courtTimerTone, elapsedSeconds, formatClockDuration, type CourtTimerTone } from "@/lib/duration";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import { finalizeMatch, updateMatchScore } from "@/features/matches/api/matchActions";
import { removeSessionCourt, toggleCourtStatus, updateSessionCourtName } from "@/features/admin/api/adminActions";
import { canSaveResult, canSendCard, cardForFreeCourt } from "@/features/courts/utils/courtRules";
import type { UpNextCard } from "@/features/queue/upNext/types";
import type { CourtActions } from "@/features/courts/hooks/useCourtActions";
import { CourtHalf } from "./CourtHalf";
import { CourtPlayerSheet } from "./CourtPlayerSheet";
import { ChoosePlayersSheet } from "./ChoosePlayersSheet";
import { PlayerPickerSheet } from "@/features/queue/components/PlayerPickerSheet";
import {
  describeRule,
  getWinner,
  quickWinScore,
  resultOnlyScore,
  type ScoringRule,
  type ScoringTeam,
} from "@/features/matches/utils/scoring";
import type { ActiveCourtView, CourtStatus, Profile, QueueEntryWithPlayer } from "@/types";

const TIMER_TONE_CLASSES: Record<CourtTimerTone, string> = {
  green: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
  red: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300",
};

export function CourtDurationClock({ startedAt }: { startedAt?: string | null }) {
  const now = useSharedNow();
  if (now === null || !startedAt) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300">
        00:00
      </span>
    );
  }
  const secs = elapsedSeconds(startedAt, now);
  const tone = courtTimerTone(secs);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono tabular-nums font-semibold ${TIMER_TONE_CLASSES[tone]}`}
    >
      {formatClockDuration(startedAt, now)}
    </span>
  );
}

export interface CourtCardProps {
  court: ActiveCourtView;
  sessionId?: string;
  waitingQueueCount?: number;
  userRole?: string;
  isAdmin?: boolean;
  readOnly?: boolean;
  targetPoints?: number;
  /** Session rule: must a team lead by 2? Defaults to true at 11 pts, false at 6. */
  winByTwo?: boolean;
  /** false: win/loss-only session, the admin just picks the winning team. */
  trackScores?: boolean;
  allowCourtRename?: boolean;
  courtSlot?: number;
  onStatusChange?: (courtId: string, status: CourtStatus) => void;
  onNameChange?: (courtSlot: number, name: string) => void;
  /** Live session with more than one court: the x removes this court when no game is on it. */
  onRemoved?: (courtId: string) => void;
  /** This session's line (for picking players). */
  queue?: QueueEntryWithPlayer[];
  /** Up Next cards and the free courts, so a free court can show its card. */
  cards?: UpNextCard[];
  freeCourtIds?: string[];
  /** Shared court actions (admin screens). Without it the court is view-only for players. */
  actions?: CourtActions;
  /** Completed games played per player in this session. */
  gamesPlayed?: Record<string, number>;
}

export function CourtCard({
  court,
  sessionId,
  waitingQueueCount = 0,
  userRole = "player",
  isAdmin,
  readOnly = false,
  targetPoints = 11,
  winByTwo,
  trackScores = true,
  allowCourtRename,
  courtSlot,
  onStatusChange,
  onNameChange,
  onRemoved,
  queue,
  cards,
  freeCourtIds,
  actions,
  gamesPlayed,
}: CourtCardProps) {
  const [isPending, startTransition] = useTransition();
  const savingResult = useRef(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const isAdministrator = !readOnly && (isAdmin ?? (userRole === "admin"));

  // The session decides the scoring rule; courts never override it.
  const courtTargetPoints = targetPoints || 11;
  const rule: ScoringRule = {
    targetPoints: courtTargetPoints,
    winByTwo: winByTwo ?? courtTargetPoints !== 6,
    trackScores,
  };
  // Win/loss-only sessions: the team the admin tapped, waiting for confirmation.
  const [pendingWinner, setPendingWinner] = useState<ScoringTeam | null>(null);

  const activeMatch = court.current_match;
  const isExistingLiveMatch = Boolean(
    court.status === "occupied" && activeMatch && activeMatch.status === "in_progress"
  );

  // Score states
  const [scoreA, setScoreA] = useState<number>(activeMatch?.team_a_score || 0);
  const [scoreB, setScoreB] = useState<number>(activeMatch?.team_b_score || 0);

  const { message: cardFlash, flash: flashCard, clear: clearCardFlash } = useFlashMessage();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  // Follow the game's saved score. The admin scoring this court keeps their own
  // count until the game changes, so a live refresh can't knock a tap back.
  const matchId = activeMatch?.id ?? null;
  const savedA = activeMatch?.team_a_score || 0;
  const savedB = activeMatch?.team_b_score || 0;
  const followSavedScore = !isAdministrator;
  useEffect(() => {
    setScoreA(savedA);
    setScoreB(savedB);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scorers resync only when the game changes
  }, [matchId, followSavedScore ? savedA : null, followSavedScore ? savedB : null]);

  // Extract players currently in active match
  const activeTeamAPlayers: Profile[] =
    activeMatch?.players
      ?.filter((p) => p.team === "team_a")
      ?.map((p) => ((p as any).player || (p as any).profile || p) as Profile)
      ?.filter((p): p is Profile => Boolean(p && p.id)) || [];

  const activeTeamBPlayers: Profile[] =
    activeMatch?.players
      ?.filter((p) => p.team === "team_b")
      ?.map((p) => ((p as any).player || (p as any).profile || p) as Profile)
      ?.filter((p): p is Profile => Boolean(p && p.id)) || [];

  // A live game, even with a slot left empty after a Remove.
  const hasPlayersOnCourt = isExistingLiveMatch && activeTeamAPlayers.length + activeTeamBPlayers.length > 0;
  const perSide: 1 | 2 = activeMatch?.format === "singles" ? 1 : 2;
  // Results only count with both teams full.
  const teamsFull = hasPlayersOnCourt && canSaveResult(activeTeamAPlayers.map((p) => p.id), activeTeamBPlayers.map((p) => p.id), perSide);

  // Live-court player actions (admins): which sheet is open, for whom.
  // Locked while any court change or result is saving, so a second tap can't act on players that are about to move.
  const canManagePlayers = Boolean(
    isAdministrator && hasPlayersOnCourt && activeMatch && actions && !actions.pending && !isPending && !pendingWinner
  );
  const waiting = (queue ?? []).filter((q) => q.status === "waiting");
  const [sheet, setSheet] = useState<
    | { kind: "player"; player: Profile; team: ScoringTeam }
    | { kind: "replace"; player: Profile }
    | { kind: "switch"; player: Profile; team: ScoringTeam }
    | { kind: "fill"; team: ScoringTeam }
    | { kind: "choose" }
    | null
  >(null);
  const nameOf = (p: Profile) => p.full_name || p.display_name || "Player";
  const teamKey = (t: ScoringTeam) => (t === "A" ? "team_a" : "team_b");
  const readyCard = cards ? cardForFreeCourt(court.id, freeCourtIds ?? [court.id], cards) : null;
  const cardName = (id: string) => readyCard?.names[id] ?? "Player";

  // Save every change so other screens (and the no-show check) see the live score,
  // and a refresh doesn't reset it.
  function setScores(a: number, b: number) {
    setScoreA(a);
    setScoreB(b);
    if (activeMatch?.id && hasPlayersOnCourt) void updateMatchScore(activeMatch.id, a, b);
  }

  function incrementScore(team: "A" | "B") {
    if (!isAdministrator) return;
    if (team === "A") setScores(scoreA + 1, scoreB);
    else setScores(scoreA, scoreB + 1);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(25);
      } catch {}
    }
  }

  function decrementScore(team: "A" | "B") {
    if (!isAdministrator) return;
    if (team === "A") setScores(Math.max(0, scoreA - 1), scoreB);
    else setScores(scoreA, Math.max(0, scoreB - 1));
  }

  function handleQuickWin(team: "A" | "B") {
    if (!isAdministrator) return;
    // Smallest valid final score: 10-10 becomes 12-10 with win by 2, or 11-10 without.
    const final = quickWinScore(team, scoreA, scoreB, rule);
    setScores(final.scoreA, final.scoreB);
  }

  /** Preview of the score Quick Win would set, e.g. "12-10". */
  function quickWinLabel(team: ScoringTeam) {
    const final = quickWinScore(team, scoreA, scoreB, rule);
    return `${final.scoreA}-${final.scoreB}`;
  }

  function handleResetScore() {
    if (!isAdministrator) return;
    setScores(0, 0);
  }

  // Victory condition follows the session rule (win by 2, or first to target)
  const winningTeam = getWinner(scoreA, scoreB, rule);
  const isGameOver = winningTeam !== null;
  const winner = winningTeam === "A" ? "Team 1" : winningTeam === "B" ? "Team 2" : null;

  function handleSubmitScore(finalA = scoreA, finalB = scoreB) {
    if (!isAdministrator || isPending) return;
    clearCardFlash();

    if (!hasPlayersOnCourt || !activeMatch) {
      flashCard("error", "Cannot submit score: No players or active match on this court.");
      return;
    }

    if (!getWinner(finalA, finalB, rule)) {
      flashCard(
        "error",
        `Cannot submit match: Score is not finished yet. This session plays ${describeRule(rule)}.`
      );
      return;
    }

    const saved = rule.trackScores === false
      ? `${finalA > finalB ? "Team 1" : "Team 2"} win`
      : `${finalA}-${finalB}`;

    // A second tap before the button greys out would only get "already saved"; ignore it.
    if (savingResult.current) return;
    savingResult.current = true;
    startTransition(async () => {
      try {
        const res = await finalizeMatch(activeMatch.id, finalA, finalB);
        if (res?.error) {
          flashCard("error", res.error);
        } else {
          flashCard("success", `Saved ${saved}. Players are back in the queue. Tap Start when the next match is ready.`);
          setScoreA(0);
          setScoreB(0);
          setPendingWinner(null);
        }
      } finally {
        savingResult.current = false;
      }
    });
  }

  /** Win/loss-only sessions: record the tapped team's win once confirmed. */
  function handleConfirmResult() {
    if (!pendingWinner) return;
    const final = resultOnlyScore(pendingWinner);
    handleSubmitScore(final.scoreA, final.scoreB);
  }

  const cleanCourtName = court.name.replace(/\s*\(Rented Court\)/i, "");

  const isClosed = court.status === "maintenance" || court.status === "reserved";
  const slot = courtSlot ?? court.sort_order ?? 1;
  const canRenameCourt = !readOnly && Boolean(sessionId) && (allowCourtRename ?? isAdministrator);
  const canChangeStatus = isAdministrator && court.status !== "occupied" && !hasPlayersOnCourt;
  const canScore = isAdministrator && teamsFull && trackScores;
  const canPickWinner = isAdministrator && teamsFull && !trackScores;

  function handleStatusChange(nextStatus: CourtStatus) {
    if (!canChangeStatus || isPending || nextStatus === court.status) return;
    clearCardFlash();
    startTransition(async () => {
      const res = await toggleCourtStatus(court.id, nextStatus, sessionId);
      if (res?.error) {
        flashCard("error", res.error);
      } else {
        onStatusChange?.(court.id, nextStatus);
      }
    });
  }

  // Only an empty court can be removed; a game in play (or players on it) hides the x.
  const canRemoveCourt =
    isAdministrator && Boolean(sessionId) && Boolean(onRemoved) && !hasPlayersOnCourt && court.status !== "occupied" && !activeMatch;

  function handleRemoveCourt() {
    if (!canRemoveCourt || !sessionId || isPending) return;
    clearCardFlash();
    startTransition(async () => {
      const res = await removeSessionCourt(sessionId, court.id);
      if (res?.error) {
        flashCard("error", res.error);
        setConfirmingRemove(false);
      } else {
        onRemoved?.(court.id);
      }
    });
  }

  function startEditingName() {
    setDraftName(cleanCourtName);
    setIsEditingName(true);
    clearCardFlash();
  }

  function handleSaveName() {
    if (!canRenameCourt || !sessionId || isPending) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      flashCard("error", "Court name is required.");
      return;
    }
    if (trimmed === cleanCourtName) {
      setIsEditingName(false);
      return;
    }
    clearCardFlash();
    startTransition(async () => {
      const res = await updateSessionCourtName(sessionId, slot, trimmed);
      if (res?.error) {
        flashCard("error", res.error);
      } else {
        onNameChange?.(slot, res?.name || trimmed);
        setIsEditingName(false);
      }
    });
  }

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-white dark:bg-slate-900/70 shadow-sm ${
        isClosed ? "border-slate-200 dark:border-slate-800 opacity-70" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {/* Header: court name, state, umpire shortcut */}
      <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isEditingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveName();
              }}
              className="flex items-center gap-1 min-w-0 flex-1"
            >
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                disabled={isPending}
                autoFocus
                maxLength={50}
                aria-label="Court name"
                className="h-11 w-full min-w-0 max-w-[160px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isPending}
                aria-label="Save court name"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                <Check className="h-4 w-4" />
              </button>
              <IconButton
                label="Cancel renaming court"
                onClick={() => setIsEditingName(false)}
                disabled={isPending}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </form>
          ) : (
            <>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {cleanCourtName}
              </h3>
              {canRenameCourt && (
                <IconButton label={`Rename ${cleanCourtName}`} onClick={startEditingName}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
              )}
              <CourtStateLabel
                state={isClosed ? court.status : hasPlayersOnCourt ? "in_play" : "open"}
                startedAt={activeMatch?.started_at}
              />
            </>
          )}
        </div>
        {isAdministrator && (!isClosed || canRemoveCourt) && (
          <div className="flex items-center">
          {!isClosed && (
            <Link
              href={`/courts/${court.id}/monitor`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500"
              title={`Open the full-screen umpire view for ${cleanCourtName}`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Umpire</span>
            </Link>
          )}
          {canRemoveCourt && !isEditingName && (
            <IconButton
              label={`Remove ${cleanCourtName}`}
              onClick={() => {
                clearCardFlash();
                setConfirmingRemove(true);
              }}
              disabled={isPending}
            >
              <X className="h-4 w-4" />
            </IconButton>
          )}
          </div>
        )}
      </header>

      {confirmingRemove && canRemoveCourt && (
        <div
          role="alertdialog"
          aria-label={`Remove ${cleanCourtName}?`}
          className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2"
        >
          <span className="text-sm font-medium text-rose-800 dark:text-rose-200">Remove {cleanCourtName}?</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirmingRemove(false)}
              disabled={isPending}
              className="h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRemoveCourt}
              disabled={isPending}
              className="h-9 cursor-pointer"
            >
              {isPending ? "Removing…" : "Remove court"}
            </Button>
          </div>
        </div>
      )}

      {/* The court itself, seen from above: Team 1 | net | Team 2 */}
      <div className="px-4">
        <div
          className={`relative grid grid-cols-[1fr_6px_1fr] overflow-hidden rounded-xl border-2 ${
            isClosed
              ? "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60"
              : "border-slate-300/90 dark:border-slate-600/70 bg-slate-50 dark:bg-slate-950/60"
          }`}
        >
          <CourtHalf
            side="A"
            label="Team 1"
            players={activeTeamAPlayers}
            score={scoreA}
            showScore={hasPlayersOnCourt && trackScores}
            isWinner={winningTeam === "A" || pendingWinner === "A"}
            closed={isClosed}
            canScore={canScore}
            onPlus={() => incrementScore("A")}
            onMinus={() => decrementScore("A")}
            plusDisabled={isGameOver || isPending}
            minusDisabled={scoreA === 0 || isPending}
            pickWinner={canPickWinner ? () => setPendingWinner("A") : undefined}
            pickDisabled={isPending}
            slots={perSide}
            onPlayerTap={canManagePlayers ? (p) => setSheet({ kind: "player", player: p, team: "A" }) : undefined}
            onAddSlot={canManagePlayers ? () => setSheet({ kind: "fill", team: "A" }) : undefined}
          />

          {/* Net */}
          <div aria-hidden className="relative bg-slate-300 dark:bg-slate-600">
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/70 dark:bg-slate-400/60" />
          </div>

          <CourtHalf
            side="B"
            label="Team 2"
            players={activeTeamBPlayers}
            score={scoreB}
            showScore={hasPlayersOnCourt && trackScores}
            isWinner={winningTeam === "B" || pendingWinner === "B"}
            closed={isClosed}
            canScore={canScore}
            onPlus={() => incrementScore("B")}
            onMinus={() => decrementScore("B")}
            plusDisabled={isGameOver || isPending}
            minusDisabled={scoreB === 0 || isPending}
            pickWinner={canPickWinner ? () => setPendingWinner("B") : undefined}
            pickDisabled={isPending}
            slots={perSide}
            onPlayerTap={canManagePlayers ? (p) => setSheet({ kind: "player", player: p, team: "B" }) : undefined}
            onAddSlot={canManagePlayers ? () => setSheet({ kind: "fill", team: "B" }) : undefined}
          />

          {isClosed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/90 dark:bg-slate-900/90 px-3 py-1 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
                {court.status === "maintenance" ? "Closed for maintenance" : "Reserved"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {cardFlash && (
        <div className="px-4 pt-3">
          {cardFlash.kind === "error" ? (
            <div role="alert" className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              <span className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {cardFlash.text}
              </span>
              <IconButton label="Dismiss message" onClick={clearCardFlash} tone="danger">
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          ) : (
            <p role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              {cardFlash.text}
            </p>
          )}
        </div>
      )}

      {/* Footer: the one thing to do next on this court */}
      <footer className="mt-auto px-4 pt-3 pb-4 space-y-2.5">
        {isClosed ? (
          canChangeStatus ? (
            <div className="space-y-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleStatusChange("available")}
                disabled={isPending}
                className="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer"
              >
                {isPending ? "Updating…" : "Reopen court"}
              </Button>
              <CourtStatusControl
                status={court.status}
                disabled={isPending}
                onSelect={handleStatusChange}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Not in use right now.
            </p>
          )
        ) : !isAdministrator ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {hasPlayersOnCourt
              ? isGameOver
                ? `Game over · ${winner} won`
                : `Game in progress · ${describeRule(rule)}`
              : "Open · waiting for the next match"}
          </p>
        ) : !hasPlayersOnCourt ? (
          <>
            {readyCard ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-sm">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Up Next {readyCard.position}</p>
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {readyCard.teamA.map(cardName).join(" & ") || "—"} <span className="text-slate-400">vs</span>{" "}
                  {readyCard.teamB.map(cardName).join(" & ") || "—"}
                </p>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                No Up Next match for this court yet · {waitingQueueCount} waiting
              </p>
            )}
            <Button
              type="button"
              variant="volt"
              onClick={() => readyCard && actions?.sendCard(readyCard.id, court.id)}
              disabled={!actions || actions.pending || !readyCard || !canSendCard(readyCard, freeCourtIds ?? [court.id])}
              className="w-full h-12 text-sm font-bold rounded-xl cursor-pointer disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              {actions?.pending ? "Starting…" : readyCard ? `Start Up Next ${readyCard.position}` : "Start"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheet({ kind: "choose" })}
              disabled={!actions || waiting.length < 2}
              className="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer disabled:cursor-not-allowed"
            >
              Choose Players
            </Button>
            {canChangeStatus && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <CourtStatusControl
                  status={court.status}
                  disabled={isPending}
                  onSelect={handleStatusChange}
                />
              </div>
            )}
          </>
        ) : !trackScores ? (
          pendingWinner ? (
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Record a win for {pendingWinner === "A" ? "Team 1" : "Team 2"}?
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingWinner(null)} disabled={isPending} className="h-11 cursor-pointer">
                  Cancel
                </Button>
                <Button type="button" variant="volt" onClick={handleConfirmResult} disabled={isPending} className="h-11 font-bold cursor-pointer">
                  {isPending ? "Saving…" : "Record win"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Tap the side that won. No score needed.
            </p>
          )
        ) : (
          <>
            <Button
              type="button"
              variant={isGameOver ? "volt" : "outline"}
              onClick={() => handleSubmitScore()}
              disabled={isPending || !isGameOver}
              className="w-full h-12 text-sm font-bold rounded-xl cursor-pointer disabled:cursor-not-allowed"
            >
              <Trophy className="h-4 w-4 mr-1.5" />
              {isPending
                ? "Saving result…"
                : isGameOver
                ? `Submit result · ${winner} wins ${Math.max(scoreA, scoreB)}–${Math.min(scoreA, scoreB)}`
                : `Playing ${describeRule(rule)}`}
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {!isGameOver && (
                <>
                  <span>Quick win:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickWin("A")}
                    className="inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
                  >
                    Team 1 ({quickWinLabel("A")})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickWin("B")}
                    className="inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-sky-700 dark:text-sky-400 hover:underline underline-offset-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
                  >
                    Team 2 ({quickWinLabel("B")})
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleResetScore}
                disabled={scoreA === 0 && scoreB === 0}
                className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-emerald-500"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </>
        )}
        {isAdministrator && hasPlayersOnCourt && !teamsFull && (
          <p className="text-center text-xs font-medium text-amber-700 dark:text-amber-400">
            Fill the empty slot to save a result.
          </p>
        )}
      </footer>

      {actions && activeMatch && sheet?.kind === "player" && (
        <CourtPlayerSheet
          name={nameOf(sheet.player)}
          courtName={cleanCourtName}
          teamLabel={sheet.team === "A" ? "Team 1" : "Team 2"}
          otherTeamLabel={sheet.team === "A" ? "Team 2" : "Team 1"}
          canSwitch={(sheet.team === "A" ? activeTeamBPlayers : activeTeamAPlayers).length > 0}
          onReplace={() => setSheet({ kind: "replace", player: sheet.player })}
          onSwitch={() => setSheet({ kind: "switch", player: sheet.player, team: sheet.team })}
          onNoShow={() => {
            actions.noShow(activeMatch.id, sheet.player.id, nameOf(sheet.player));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {actions && activeMatch && sheet?.kind === "replace" && (
        <PlayerPickerSheet
          title={`Replace ${nameOf(sheet.player)}`}
          subtitle={`${cleanCourtName}. ${nameOf(sheet.player)} goes to the back of the line.`}
          candidates={waiting}
          gamesPlayed={gamesPlayed}
          onAutoPick={() => {
            actions.autoPick(activeMatch.id, sheet.player.id);
            setSheet(null);
          }}
          onPick={(id, name) => {
            actions.replace(activeMatch.id, sheet.player.id, id, name);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {actions && activeMatch && sheet?.kind === "switch" && (
        <PlayerPickerSheet
          title={`Switch ${nameOf(sheet.player)} with…`}
          candidates={(sheet.team === "A" ? activeTeamBPlayers : activeTeamAPlayers).map((p) => ({
            id: p.id,
            player_id: p.id,
            player: p,
            joined_at: new Date().toISOString(),
            group_id: null,
          }) as unknown as QueueEntryWithPlayer)}
          gamesPlayed={gamesPlayed}
          showWait={false}
          onPick={(id) => {
            actions.switchTeams(activeMatch.id, sheet.player.id, id);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {actions && activeMatch && sheet?.kind === "fill" && (
        <PlayerPickerSheet
          title={`Add a player to ${sheet.team === "A" ? "Team 1" : "Team 2"}`}
          candidates={waiting}
          gamesPlayed={gamesPlayed}
          onAutoPick={() => {
            actions.autoFill(activeMatch.id, teamKey(sheet.team));
            setSheet(null);
          }}
          onPick={(id, name) => {
            actions.fill(activeMatch.id, teamKey(sheet.team), id, name);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {actions && sheet?.kind === "choose" && (
        <ChoosePlayersSheet
          courtName={cleanCourtName}
          candidates={waiting}
          perSide={2}
          pending={actions.pending}
          gamesPlayed={gamesPlayed}
          onFill={(teamA, teamB) => {
            actions.startChosen(court.id, teamA, teamB);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </article>
  );
}

type CourtState = "in_play" | "open" | ActiveCourtView["status"];

function CourtStateLabel({ state, startedAt }: { state: CourtState; startedAt?: string | null }) {
  if (state === "in_play") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          In play
        </span>
        <CourtDurationClock startedAt={startedAt} />
      </span>
    );
  }
  if (state === "open" || state === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {state === "maintenance" ? "Closed" : state === "reserved" ? "Reserved" : "Busy"}
    </span>
  );
}

const COURT_STATUS_OPTIONS: { value: CourtStatus; label: string }[] = [
  { value: "available", label: "Open" },
  { value: "maintenance", label: "Maintenance" },
  { value: "reserved", label: "Reserved" },
];

function CourtStatusControl({
  status,
  disabled,
  onSelect,
}: {
  status: CourtStatus;
  disabled: boolean;
  onSelect: (next: CourtStatus) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
        Court status
      </span>
      <div
        role="group"
        aria-label="Court status"
        className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/70 p-0.5 flex-1 max-w-[236px]"
      >
        {COURT_STATUS_OPTIONS.map((option) => {
          const active = status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onSelect(option.value)}
              className={`min-h-11 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
