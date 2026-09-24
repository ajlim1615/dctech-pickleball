"use client";

import { useState, useMemo } from "react";
import { Activity, Sparkles, Filter } from "lucide-react";
import { CourtCard } from "./CourtCard";
import type { ActiveCourtView, QueueEntryWithPlayer } from "@/types";

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
}: CourtMatrixProps) {
  const [filter, setFilter] = useState<"all" | "occupied" | "available">("all");

  const isAdministrator = !readOnly && (isAdmin ?? (userRole === "admin"));

  const waitingCount =
    waitingQueueCount !== undefined
      ? waitingQueueCount
      : queue
      ? queue.filter((q) => q.status === "waiting").length
      : 0;

  const courtsToDisplay: ActiveCourtView[] = useMemo(() => {
    if (initialCourts && initialCourts.length > 0) {
      return initialCourts;
    }
    return defaultFreshCourts;
  }, [initialCourts]);

  const filteredCourts = useMemo(() => {
    return courtsToDisplay.filter((c) => {
      if (filter === "all") return true;
      return c.status === filter;
    });
  }, [courtsToDisplay, filter]);

  const occupiedCount = courtsToDisplay.filter((c) => c.status === "occupied").length;
  const availableCount = courtsToDisplay.filter((c) => c.status === "available").length;

  return (
    <div className="space-y-4">
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
          {filteredCourts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              sessionId={sessionId}
              waitingQueueCount={waitingCount}
              userRole={userRole}
              isAdmin={isAdministrator}
              readOnly={readOnly}
              targetPoints={targetPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
}
