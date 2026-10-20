"use client";

import { useEffect } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueueCallupAlertProps {
  courtName?: string;
  onAcknowledge: () => void;
}

/**
 * Shown to a player the moment they are put on a court. Also vibrates and, when
 * the tab is in the background and notifications are allowed, sends one.
 */
export function QueueCallupAlert({ courtName, onAcknowledge }: QueueCallupAlertProps) {
  const where = courtName || "your court";

  useEffect(() => {
    try {
      navigator.vibrate?.([200, 100, 200, 100, 400]);
    } catch {}
    try {
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification("You're up", { body: `Head to ${where} now.`, tag: "pickleball-callup" });
      }
    } catch {}
  }, [where]);

  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-20 z-50 mx-auto max-w-md rounded-2xl border-2 border-[#d4e938] bg-slate-950 p-4 text-slate-100 shadow-2xl sm:inset-x-auto sm:right-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d4e938] text-slate-950">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">You&apos;re up</p>
          <p className="mt-0.5 text-sm text-slate-300">
            Head to <span className="font-semibold text-white">{where}</span> now. Your game is starting.
          </p>
          <Button variant="volt" onClick={onAcknowledge} className="mt-3 h-11 px-5 font-bold cursor-pointer">
            On my way
          </Button>
        </div>
        <button
          type="button"
          onClick={onAcknowledge}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Ask once, from a click, so the call-up can reach players whose phone screen is off. */
export function requestCallupNotifications() {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {}
}
