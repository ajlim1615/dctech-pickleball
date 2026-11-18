"use client";

import { useState, useTransition } from "react";
import {
  autoFillSlot,
  autoPickReplacement,
  fillSlot,
  markNoShow,
  removeFromCourt,
  replacePlayer,
  switchTeams,
  undoCourtChange,
  type CourtChangeResult,
} from "@/features/courts/api/courtPlayerActions";
import { sendUpNextToCourt, startChosenPlayers } from "@/features/queue/api/upNextActions";

type Team = "team_a" | "team_b";

/** The change the Undo toast can put back. */
export type LastCourtChange = { matchId: string; changeId: string; message: string; at: number };

/**
 * Every live-court and free-court action, shared by the session page and the court
 * monitor. Tracks the pending state, the last error, and the last undoable change.
 */
export function useCourtActions(sessionId?: string) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<LastCourtChange | null>(null);

  function run(matchId: string, message: string, action: () => Promise<CourtChangeResult>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setNotice(res.unpaired.length > 0 ? `${message} They are no longer paired.` : message);
      setLastChange(res.changeId ? { matchId, changeId: res.changeId, message, at: Date.now() } : null);
    });
  }

  function start(action: () => Promise<{ success: true } | { error: string }>, message: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res) setError(res.error);
      else setNotice(message);
    });
  }

  return {
    pending,
    error,
    notice,
    lastChange,
    clearMessages: () => {
      setError(null);
      setNotice(null);
    },
    dismissUndo: () => setLastChange(null),
    replace: (matchId: string, outId: string, inId: string, name: string) =>
      run(matchId, `${name} is in.`, () => replacePlayer(matchId, outId, inId)),
    autoPick: (matchId: string, outId: string) => run(matchId, "Replaced.", () => autoPickReplacement(matchId, outId)),
    switchTeams: (matchId: string, p1: string, p2: string) => run(matchId, "Teams switched.", () => switchTeams(matchId, p1, p2)),
    remove: (matchId: string, playerId: string, name: string) =>
      run(matchId, `${name} is back at the front of the line.`, () => removeFromCourt(matchId, playerId)),
    fill: (matchId: string, team: Team, playerId: string, name: string) =>
      run(matchId, `${name} is in.`, () => fillSlot(matchId, team, playerId)),
    autoFill: (matchId: string, team: Team) => run(matchId, "Slot filled.", () => autoFillSlot(matchId, team)),
    noShow: (matchId: string, playerId: string, name: string) =>
      run(matchId, `${name} is on a break; the next in line is in.`, () => markNoShow(matchId, playerId)),
    undo: (change: LastCourtChange) => {
      setLastChange(null);
      run(change.matchId, "Undone.", () => undoCourtChange(change.matchId, change.changeId));
    },
    sendCard: (cardId: string, courtId: string) => {
      if (!sessionId) return;
      start(() => sendUpNextToCourt(sessionId, cardId, courtId), "Game started.");
    },
    startChosen: (courtId: string, teamA: string[], teamB: string[]) => {
      if (!sessionId) return;
      start(() => startChosenPlayers(sessionId, courtId, teamA, teamB), "Game started.");
    },
  };
}

export type CourtActions = ReturnType<typeof useCourtActions>;
