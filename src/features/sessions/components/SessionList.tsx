import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatPHTTime } from "@/lib/timezone";
import { SessionRow, SessionRuleChips } from "@/features/sessions/components/SessionRow";
import { RsvpButton } from "@/features/sessions/components/RsvpButton";
import type { Session } from "@/types";

interface SessionListProps {
  initialSessions: Session[];
  userRole?: string;
  /** RSVP head count per upcoming session. */
  rsvpCounts?: Record<string, number>;
  /** Upcoming sessions the viewer said they're going to. */
  myRsvps?: string[];
}

const viewLink =
  "inline-flex h-10 items-center rounded-md border border-slate-300 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";

/** All sessions: what's live, what's coming up, and past results. */
export function SessionList({ initialSessions, userRole = "player", rsvpCounts = {}, myRsvps = [] }: SessionListProps) {
  const isAdmin = userRole === "admin";
  const live = initialSessions.filter((s) => s.status === "active");
  const upcoming = initialSessions
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const past = initialSessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8 pb-24 sm:pb-12">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Sessions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Open play times, the rules for each, and past results.</p>
      </header>

      {live.map((s) => (
        <Link
          key={s.id}
          href={`/sessions/${s.id}`}
          className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-emerald-500/50 bg-white dark:bg-slate-900/70 p-5 hover:border-emerald-500 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live now, until {formatPHTTime(s.end_time)}
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{s.title}</h2>
            <SessionRuleChips description={s.description} />
          </div>
          <span className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#d4e938] px-5 text-sm font-bold text-slate-950 group-hover:bg-[#c2d730]">
            {isAdmin ? "Open session console" : "Check in & play"}
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-sm text-slate-500 dark:text-slate-400">
            {isAdmin ? "Nothing scheduled. Create a session from the Admin page." : "Nothing scheduled yet. Check back soon."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            {upcoming.map((s) => (
              <SessionRow key={s.id} session={s} rsvpCount={rsvpCounts[s.id]}>
                {!isAdmin && (
                  <RsvpButton sessionId={s.id} going={myRsvps.includes(s.id)} count={rsvpCounts[s.id] || 0} />
                )}
                <Link href={`/sessions/${s.id}`} className={viewLink}>
                  View
                </Link>
              </SessionRow>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none select-none py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Past sessions ({past.length})
            <span className="text-xs font-medium text-slate-500 group-open:hidden">Show</span>
            <span className="text-xs font-medium text-slate-500 hidden group-open:inline">Hide</span>
          </summary>
          <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            {past.map((s) => (
              <SessionRow key={s.id} session={s} muted>
                <Link href={`/sessions/${s.id}`} className={viewLink}>
                  Results
                </Link>
              </SessionRow>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
