"use client";

import { useState, useMemo, useEffect } from "react";
import { Activity, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { CourtCard } from "./CourtCard";
import { useLiveCourts } from "../hooks/useLiveCourts";
import { useCourtActions } from "../hooks/useCourtActions";
import { useLiveUpNext } from "@/features/queue/hooks/useLiveUpNext";
import { UndoToast } from "./UndoToast";
import { applySessionCourtNames } from "@/lib/utils";
import type { ActiveCourtView, CourtStatus, QueueEntryWithPlayer } from "@/types";

// Stable default: a fresh [] each render would re-sync the live hook forever.
const NO_COURTS: ActiveCourtView[] = [];

const defaultFreshCourts: ActiveCourtView[] = [
  {
    id: "1",
    name: "Court 1",
    surface_type: "Pro Acrylic Court",
    status: "available",
    sort_order: 1,
    current_match_id: null,
    assigned_staff_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Court 2",
    surface_type: "Pro Acrylic Court",
    status: "available",
    sort_order: 2,
    current_match_id: null,
    assigned_staff_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Court 3",
    surface_type: "Pro Acrylic Court",
    status: "available",
    sort_order: 3,
    current_match_id: null,
    assigned_staff_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Court 4",
    surface_type: "Pro Acrylic Court",
    status: "available",
    sort_order: 4,
    current_match_id: null,
    assigned_staff_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

interface CourtMatrixProps {
  initialCourts?: ActiveCourtView[];
  userRole?: string;
  sessionId?: string;
  waitingQueueCount?: number;
  queue?: QueueEntryWithPlayer[];
  isAdmin?: boolean;
  readOnly?: boolean;
  targetPoints?: number;
  winByTwo?: boolean;
  trackScores?: boolean;
  allowCourtRename?: boolean;
  courtNames?: Record<string, string>;
  syncArenaList?: boolean;
}

export function CourtMatrix({
  initialCourts,
  sessionId,
  userRole = "player",
  waitingQueueCount,
  queue,
  isAdmin,
  readOnly = false,
  targetPoints = 11,
  winByTwo,
  trackScores,
  allowCourtRename,
  courtNames,
  syncArenaList = false,
}: CourtMatrixProps) {
  const [filter, setFilter] = useState<"all" | "occupied" | "available">("all");
  const [localCourtNames, setLocalCourtNames] = useState<Record<string, string>>(courtNames ?? {});

  useEffect(() => {
    setLocalCourtNames(courtNames ?? {});
  }, [courtNames]);

  const isAdministrator = !readOnly && (isAdmin ?? (userRole === "admin"));

  const waitingCount =
    waitingQueueCount !== undefined
      ? waitingQueueCount
      : queue
      ? queue.filter((q) => q.status === "waiting").length
      : 0;

  // Cards update live when a court or its game changes, without reloading the page.
  const { courts: liveCourts, setCourts } = useLiveCourts(
    initialCourts ?? NO_COURTS,
    syncArenaList
  );

  // Admin screens: live Up Next cards, the shared court actions and one Undo toast.
  const upNextCards = useLiveUpNext(isAdministrator ? sessionId : undefined);
  const courtActions = useCourtActions(sessionId);

  function handleCourtStatusChange(courtId: string, status: CourtStatus) {
    setCourts((prev) =>
      prev.map((c) => (c.id === courtId ? { ...c, status } : c))
    );
  }

  function handleCourtNameChange(courtSlot: number, name: string) {
    setLocalCourtNames((prev) => ({ ...prev, [String(courtSlot)]: name }));
  }

  const courtsToDisplay: ActiveCourtView[] = useMemo(() => {
    const base = liveCourts.length > 0 ? liveCourts : defaultFreshCourts;
    return applySessionCourtNames(base, localCourtNames);
  }, [liveCourts, localCourtNames]);

  const filteredCourts = useMemo(() => {
    return courtsToDisplay.filter((c) => {
      if (filter === "all") return true;
      return c.status === filter;
    });
  }, [courtsToDisplay, filter]);

  const occupiedCount = courtsToDisplay.filter((c) => c.status === "occupied").length;
  const availableCount = courtsToDisplay.filter((c) => c.status === "available").length;
  const freeCourtIds = courtsToDisplay
    .filter((c) => c.status === "available" && !c.current_match_id)
    .map((c) => c.id);

  return (
    <div className="space-y-4">
      {isAdministrator && courtActions.message && (
        <div
          role={courtActions.message.kind === "error" ? "alert" : "status"}
          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
            courtActions.message.kind === "error"
              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          <span>{courtActions.message.text}</span>
          {courtActions.message.kind === "error" && (
            <IconButton label="Dismiss message" onClick={courtActions.clearMessages} tone="danger">
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      )}
      {isAdministrator && courtActions.lastChange && (
        <UndoToast change={courtActions.lastChange} onUndo={courtActions.undo} onDismiss={courtActions.dismissUndo} />
      )}
      {/* Grid of Courts */}
      {courtsToDisplay.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/40 p-12 text-center space-y-3 font-mono text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          <Activity className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto animate-pulse" />
          <p className="text-slate-900 dark:text-slate-200 font-bold text-sm">No Courts Match Filter</p>
          <p className="text-slate-500 max-w-sm mx-auto">
            Switch filter to &quot;All Courts&quot; to monitor the full arena matrix.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCourts.map((court, index) => (
            <CourtCard
              key={court.id}
              court={court}
              sessionId={sessionId}
              waitingQueueCount={waitingCount}
              userRole={userRole}
              isAdmin={isAdministrator}
              readOnly={readOnly}
              targetPoints={targetPoints}
              winByTwo={winByTwo}
              trackScores={trackScores}
              allowCourtRename={allowCourtRename}
              courtSlot={court.sort_order ?? index + 1}
              onStatusChange={handleCourtStatusChange}
              onNameChange={handleCourtNameChange}
              queue={queue}
              cards={isAdministrator && sessionId ? upNextCards : undefined}
              freeCourtIds={freeCourtIds}
              actions={isAdministrator && sessionId ? courtActions : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
