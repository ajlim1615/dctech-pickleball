"use client";

import { ArrowLeftRight, Repeat, UserX } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";

/** What an admin can do with one player on a live court. */
export function CourtPlayerSheet({
  name,
  courtName,
  teamLabel,
  otherTeamLabel,
  canSwitch,
  onReplace,
  onSwitch,
  onNoShow,
  onClose,
}: {
  name: string;
  courtName: string;
  teamLabel: string;
  otherTeamLabel: string;
  canSwitch: boolean;
  onReplace: () => void;
  onSwitch: () => void;
  onNoShow: () => void;
  onClose: () => void;
}) {
  const item =
    "flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-3 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <Sheet
      title={name}
      subtitle={`${courtName} · ${teamLabel}`}
      onClose={onClose}
      size="sm"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          Cancel
        </button>
      }
    >
      <div className="space-y-1">
        <button type="button" className={item} onClick={onReplace}>
          <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Replace player</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Choose someone from the line; {name} goes to the back</span>
          </span>
        </button>
        <button type="button" className={item} onClick={onSwitch} disabled={!canSwitch}>
          <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Switch teams</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">Switch with someone on {otherTeamLabel}</span>
          </span>
        </button>
        <button type="button" className={item} onClick={onNoShow}>
          <UserX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Mark as no-show</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">The next in line comes in; {name} goes on a break</span>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
