import Link from "next/link";
import { ArrowRight, Calendar, Coffee, Trophy } from "lucide-react";
import { CourtMatrix } from "@/features/courts/components/CourtMatrix";
import { SessionQueueLiveBoard } from "@/features/sessions/components/SessionQueueLiveBoard";
import { SessionRow, SessionRuleChips } from "@/features/sessions/components/SessionRow";
import { formatPHTDate, formatPHTTime } from "@/lib/timezone";
import { formatRating, parseSessionMetadata } from "@/lib/utils";
import type { RankedPlayer } from "@/features/rankings/api/rankingActions";
import type { ActiveCourtView, Profile, QueueEntryWithPlayer, Session } from "@/types";

export interface HomeViewProps {
  activeSession: Session | null;
  upcomingSessions: Session[];
  courts: ActiveCourtView[];
  queue: QueueEntryWithPlayer[];
  employees: Profile[];
  leaderboard: RankedPlayer[];
  viewer: { id?: string; email?: string; role: string; isAdmin: boolean };
}

type ViewerStatus =
  | { kind: "admin" }
  | { kind: "on_court"; courtName: string }
  | { kind: "on_break" }
  | { kind: "in_line"; position: number }
  | { kind: "not_in" };

function viewerStatus(viewer: HomeViewProps["viewer"], courts: ActiveCourtView[], queue: QueueEntryWithPlayer[]): ViewerStatus {
  if (viewer.isAdmin) return { kind: "admin" };
  if (!viewer.id) return { kind: "not_in" };
  const court = courts.find(
    (c) => c.current_match?.status === "in_progress" && c.current_match.players?.some((p) => p.player_id === viewer.id)
  );
  if (court) return { kind: "on_court", courtName: court.name.replace(/\s*\(Rented Court\)/i, "") };
  const entry = queue.find((q) => q.player_id === viewer.id);
  if (entry?.status === "on_break") return { kind: "on_break" };
  if (entry) {
    const position = queue.filter((q) => q.status !== "on_break").findIndex((q) => q.player_id === viewer.id) + 1;
    return { kind: "in_line", position: Math.max(1, position) };
  }
  return { kind: "not_in" };
}

/** The player-facing home: what's happening now, where you stand, and what's next. */
export function HomeView({ activeSession, upcomingSessions, courts, queue, employees, leaderboard, viewer }: HomeViewProps) {
  const meta = activeSession ? parseSessionMetadata(activeSession.description) : null;
  const status = viewerStatus(viewer, courts, queue);
  const waiting = queue.filter((q) => q.status === "waiting").length;
  const inPlay = courts.filter((c) => c.status === "occupied").length;
  const nextSession = upcomingSessions[0];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 pb-24 sm:pb-12">
      {activeSession && meta ? (
        <>
          {/* Live now + where you stand */}
          <section className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,400px)] lg:items-stretch">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live now, until {formatPHTTime(activeSession.end_time)}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {activeSession.title}
              </h1>
              <SessionRuleChips description={activeSession.description} />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{waiting}</span> waiting,{" "}
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{inPlay}</span> of{" "}
                {courts.length} courts in play. {activeSession.location || "DCTECH Sports Arena"}.
              </p>
            </div>

            <YourStatusCard status={status} sessionId={activeSession.id} />
          </section>

          {/* Courts and the line */}
          <section aria-label="Courts and queue" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CourtMatrix
                initialCourts={courts}
                userRole={viewer.role}
                isAdmin={viewer.isAdmin}
                readOnly
                sessionId={activeSession.id}
                queue={queue}
                waitingQueueCount={waiting}
                targetPoints={meta.targetPoints}
                winByTwo={meta.winByTwo}
                trackScores={meta.trackScores}
              />
            </div>
            <SessionQueueLiveBoard
              initialQueue={queue}
              sessionId={activeSession.id}
              currentUserId={viewer.id}
              userRole={viewer.role}
              userEmail={viewer.email}
              employees={employees}
              isSessionActive
              readOnly
              matchingMode={meta.matchingMode}
              courts={courts}
            />
          </section>
        </>
      ) : (
        /* Nothing live: lead with the next session */
        <section className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {nextSession ? "Next open play" : "No open play scheduled"}
          </h1>
          {nextSession ? (
            <Link
              href={`/sessions/${nextSession.id}`}
              className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-emerald-500/40 bg-white dark:bg-slate-900/70 p-5 hover:border-emerald-500 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <Calendar className="h-4 w-4" />
                  {formatPHTDate(nextSession.start_time)}, {formatPHTTime(nextSession.start_time)} – {formatPHTTime(nextSession.end_time)}
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{nextSession.title}</h2>
                <SessionRuleChips description={nextSession.description} />
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                View session
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {viewer.isAdmin ? (
                <>
                  Create one from the{" "}
                  <Link href="/admin" className="font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2">
                    Admin page
                  </Link>
                  .
                </>
              ) : (
                "Check back soon. New sessions show up here as soon as they're scheduled."
              )}
            </p>
          )}
        </section>
      )}

      {/* What's next, and who's on top */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {activeSession ? "Coming up" : "Later sessions"}
            </h2>
            <Link href="/sessions" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2">
              All sessions
            </Link>
          </div>
          {(() => {
            const list = (activeSession ? upcomingSessions : upcomingSessions.slice(1)).slice(0, 3);
            return list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-sm text-slate-500 dark:text-slate-400">
                Nothing else on the calendar yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
                {list.map((s) => (
                  <SessionRow key={s.id} session={s}>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="inline-flex h-10 items-center rounded-md border border-slate-300 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      View
                    </Link>
                  </SessionRow>
                ))}
              </ul>
            );
          })()}
        </div>

        <TopPlayers leaderboard={leaderboard} viewerId={viewer.id} />
      </section>
    </div>
  );
}

function YourStatusCard({ status, sessionId }: { status: ViewerStatus; sessionId: string }) {
  const content: Record<ViewerStatus["kind"], { title: string; detail: string; cta: string; primary: boolean }> = {
    admin: { title: "You're running this session", detail: "Queue, courts and results are in the console.", cta: "Open session console", primary: true },
    on_court: { title: "", detail: "You rejoin the line after the game.", cta: "Open session", primary: false },
    on_break: { title: "You're on a break", detail: "Your place in line is saved. Tap I'm back on the session page to rejoin.", cta: "Go to session", primary: true },
    in_line: { title: "", detail: "We'll alert you when it's your turn.", cta: "Open session", primary: false },
    not_in: { title: "Want to play?", detail: "Check in to join the queue. The first four in line play next.", cta: "Check in", primary: true },
  };
  const c = content[status.kind];
  const title =
    status.kind === "on_court"
      ? `You're playing on ${status.courtName}`
      : status.kind === "in_line"
      ? `You're #${status.position} in line${status.position <= 4 ? ", up next" : ""}`
      : c.title;

  return (
    <div
      className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 ${
        status.kind === "on_court" || status.kind === "in_line"
          ? "border-emerald-500/50 bg-emerald-50/60 dark:bg-emerald-950/20"
          : status.kind === "on_break"
          ? "border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70"
      }`}
    >
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          {status.kind === "on_break" && <Coffee className="h-5 w-5 text-amber-500" />}
          {title}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{c.detail}</p>
      </div>
      <Link
        href={`/sessions/${sessionId}`}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
          c.primary
            ? "bg-[#d4e938] hover:bg-[#c2d730] text-slate-950"
            : "border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800"
        }`}
      >
        {c.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function TopPlayers({ leaderboard, viewerId }: { leaderboard: RankedPlayer[]; viewerId?: string }) {
  const top = leaderboard.slice(0, 5);
  const me = viewerId ? leaderboard.find((p) => p.id === viewerId) : undefined;
  const meOutsideTop = me && !top.some((p) => p.id === me.id);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
          <Trophy className="h-5 w-5 text-amber-500" />
          Top players
        </h2>
        <Link href="/rankings" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2">
          Rankings
        </Link>
      </div>
      {top.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-sm text-slate-500 dark:text-slate-400">
          Rankings appear after the first ranked games.
        </p>
      ) : (
        <ol className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          {top.map((p) => (
            <RankRow key={p.id} player={p} isMe={p.id === viewerId} />
          ))}
          {meOutsideTop && me && <RankRow player={me} isMe />}
        </ol>
      )}
    </div>
  );
}

function RankRow({ player, isMe }: { player: RankedPlayer; isMe: boolean }) {
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""}`}>
      <span className="w-6 text-right font-mono text-sm tabular-nums text-slate-500 dark:text-slate-400">{player.rank}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
        {player.full_name || player.display_name || "Player"}
        {isMe && <span className="ml-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">You</span>}
      </span>
      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {formatRating(player.skill_rating)}
      </span>
    </li>
  );
}
