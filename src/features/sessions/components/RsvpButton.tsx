"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { setRsvp } from "@/features/sessions/api/rsvpActions";

/** "I'm going" toggle for an upcoming session, updated optimistically. */
export function RsvpButton({ sessionId, going, count }: { sessionId: string; going: boolean; count: number }) {
  const router = useRouter();
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
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      {state.going ? (
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex h-11 items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <Check className="h-4 w-4" />
            Going
          </span>
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={isPending}
            className="h-11 rounded-md px-3 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 disabled:opacity-50 cursor-pointer"
          >
            Undo
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={isPending}
          className="inline-flex h-11 items-center rounded-md border border-slate-300 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
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
