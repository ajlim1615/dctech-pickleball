"use client";

import { BellRing, Check, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueueCallupAlertProps {
  courtName?: string;
  onAcknowledge: () => void;
}

export function QueueCallupAlert({ courtName = "Court 1", onAcknowledge }: QueueCallupAlertProps) {
  return (
    <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-lg animate-bounce rounded-2xl border-2 border-[#d4e938] bg-[#090d14]/95 p-5 shadow-2xl shadow-[#d4e938]/20 backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:top-24">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d4e938] font-mono text-slate-950 shadow-md">
          <BellRing className="h-6 w-6 animate-pulse" />
        </div>

        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#d4e938]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#d4e938] uppercase">
              YOU ARE CALLED UP!
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-100">
            Head to {courtName} Now
          </h3>
          <p className="text-xs text-slate-300">
            Your match is ready to start. Grab your paddle and warm up.
          </p>

          <div className="pt-2 flex items-center gap-2">
            <Button
              variant="volt"
              size="sm"
              onClick={onAcknowledge}
              className="text-xs font-bold"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              On My Way
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onAcknowledge}
              className="text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
