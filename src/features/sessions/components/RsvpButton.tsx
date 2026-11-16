"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setRsvp } from "@/features/sessions/api/rsvpActions";

/** "I'm going" toggle for an upcoming session, updated optimistically. */
export function RsvpButton({
  sessionId,
  going,
  count,
  variant = "default",
}: {
  sessionId: string;
  going: boolean;
  count: number;
  /** "dark" for use on the always-dark home hero. */
  variant?: "default" | "dark";
}) {
  const dark = variant === "dark";
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState({ going, count });
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    const previous = state;
    setError(null);
    setState({ going: next, count: Math.max(0, state.count + (next ? 1 : -1)) });
    startTransition(async () => {
      const res = await setRsvp(sessionId, next);
      if (res?.error) {
        setState(previous);
        setError(res.error);
      } else {
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {state.going ? (
        <span className="inline-flex items-center gap-1">
          <span className={dark
              ? "inline-flex h-11 items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 px-4 text-sm font-bold text-emerald-300"
              : "inline-flex h-11 items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300"}>
            <Check className="h-4 w-4" />
            Going
          </span>
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={isPending}
            className={dark
              ? "h-11 rounded-full px-3 text-sm font-medium text-slate-400 hover:text-white disabled:opacity-50 cursor-pointer"
              : "h-11 rounded-md px-3 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 disabled:opacity-50 cursor-pointer"}
          >
            Undo
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={isPending}
          className={dark
            ? "inline-flex h-11 items-center rounded-full border border-white/20 bg-white/5 px-5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50 cursor-pointer"
            : "inline-flex h-11 items-center rounded-md border border-slate-300 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"}
        >
          I&apos;m going
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      )}
    </span>
  );
}
