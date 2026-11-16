"use client";

import { useState } from "react";

export interface GoingPlayer {
  playerId: string;
  name: string;
  avatarUrl: string | null;
}

const PREVIEW = 11;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "P";
}

/** Who said they're going: photo or initials, you first, the rest in sign-up order. */
export function WhosGoing({ rsvps, currentUserId }: { rsvps: GoingPlayer[]; currentUserId?: string }) {
  const [showAll, setShowAll] = useState(false);
  const me = rsvps.find((r) => r.playerId === currentUserId);
  const ordered = me ? [me, ...rsvps.filter((r) => r !== me)] : rsvps;
  const visible = showAll ? ordered : ordered.slice(0, PREVIEW);
  const hidden = ordered.length - visible.length;

  return (
    <section aria-labelledby="rsvp-heading" className="space-y-3">
      <h2 id="rsvp-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
        Who&apos;s going <span className="font-mono text-slate-500 dark:text-slate-400">{rsvps.length}</span>
      </h2>

      {rsvps.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Be the first: tap I&apos;m going and you&apos;ll be shuffled into the line when it starts.
        </p>
      ) : (
        <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2.5">
          {visible.map((r) => {
            const isMe = r.playerId === currentUserId;
            return (
              <li key={r.playerId} className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`h-8 w-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold font-mono ${
                    isMe
                      ? "ring-2 ring-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(r.name)
                  )}
                </span>
                <span
                  className={`truncate text-sm ${
                    isMe ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {isMe ? "You" : r.name}
                </span>
              </li>
            );
          })}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="h-8 rounded-full px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
              >
                Show all {ordered.length}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
