import Link from "next/link";
import {
  Calendar,
  PlayCircle,
  ShieldCheck,
  Clock,
  Users,
  ArrowRight,
  Trophy,
  Zap,
  Activity,
  Award,
  MapPin,
  Flame,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourtMatrix } from "@/features/courts/components/CourtMatrix";
import { SessionQueueLiveBoard } from "@/features/sessions/components/SessionQueueLiveBoard";
import { getCourts } from "@/features/courts/api/courtActions";
import { getSessions } from "@/features/sessions/api/sessionActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getLeaderboard } from "@/features/rankings/api/rankingActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getQueueForSession } from "@/features/queue/api/queueActions";
import { cleanSessionDescription, formatRating, parseSessionMetadata } from "@/lib/utils";

export default async function HomePage() {
  const [courts, sessions, authData, leaderboard] = await Promise.all([
    getCourts(),
    getSessions(),
    getCurrentUser(),
    getLeaderboard(),
  ]);

  const userEmail = authData?.user?.email || authData?.profile?.email;
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = authData?.profile?.role === "admin" || isSystemAdmin;
  const activeSession = sessions.find((s) => s.status === "active");
  const activeSessionMeta = activeSession ? parseSessionMetadata(activeSession.description) : null;
  const upcomingSessions = sessions.filter((s) => s.status === "scheduled");
  const activeCourtsCount = courts.filter((c) => c.status === "occupied").length;
  const totalCourtsCount = courts.length;

  // Only fetch full employee roster and live queue if an active session is in play
  const [employees, rawQueue] = activeSession
    ? await Promise.all([getAllEmployees(), getQueueForSession(activeSession.id)])
    : [[], []];

  const activeDescription = cleanSessionDescription(activeSession?.description);

  // Top 3 players from leaderboard
  const topPlayers = (leaderboard || []).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8 pb-24 sm:pb-12">
      {/* STADIUM ATMOSPHERE HERO (Double-Bezel Architecture) */}
      <section className="relative rounded-[2rem] p-1.5 sm:p-2 border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-[#070b12] text-white shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Subtle Ambient Stadium Radial Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-[#d4e938]/10 blur-3xl" />

        {/* Inner Core */}
        <div className="relative z-10 rounded-[1.6rem] border border-white/10 bg-slate-950/60 p-5 sm:p-8 space-y-6">
          {/* Top Eyebrow & Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {activeSession ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-1 text-xs font-mono font-extrabold text-emerald-400 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>LIVE MATCHES IN PLAY</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/60 px-3.5 py-1 text-xs font-mono font-extrabold text-amber-400 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                  <span>ARENA STANDBY • SCHEDULED PLAY</span>
                </div>
              )}

              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>{activeSession?.location || "DCTECH Sports Arena"}</span>
              </span>
            </div>

            {activeSession ? (
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  {new Date(activeSession.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                  {new Date(activeSession.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            ) : upcomingSessions.length > 0 ? (
              <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                <span>Next Session: {new Date(upcomingSessions[0].start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
              </div>
            ) : null}
          </div>

          {/* Hero Main Content & Nested CTA Hub */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                {activeSession ? activeSession.title : "DCTECH Open Play & Arena Matrix"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                {activeDescription ||
                  "Real-time court match matrices, referee scoreboards, and FIFO paddle rotation queue for DCTECH pickleball athletes."}
              </p>
            </div>

            {/* Contextual Action Hub (Button-in-Button Architecture) */}
            <div className="flex flex-wrap items-center gap-3">
              {activeSession ? (
                <Link href={`/sessions/${activeSession.id}`}>
                  <button
                    type="button"
                    className="group inline-flex items-center justify-between gap-3 rounded-full bg-[#d4e938] hover:bg-[#c3d82f] text-slate-950 font-extrabold text-xs sm:text-sm pl-5 pr-2 py-2 shadow-lg shadow-[#d4e938]/20 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <span>{isAdmin ? "Open Session Controls" : "Check In & Enter Queue"}</span>
                    <span className="h-8 w-8 rounded-full bg-slate-950/10 flex items-center justify-center text-slate-950 transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                </Link>
              ) : (
                isAdmin ? (
                  <Link href="/admin">
                    <button
                      type="button"
                      className="group inline-flex items-center justify-between gap-3 rounded-full bg-[#d4e938] hover:bg-[#c3d82f] text-slate-950 font-extrabold text-xs sm:text-sm pl-5 pr-2 py-2 shadow-lg shadow-[#d4e938]/20 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Zap className="h-4 w-4 fill-slate-950" />
                      <span>Start Session in Admin</span>
                      <span className="h-8 w-8 rounded-full bg-slate-950/10 flex items-center justify-center text-slate-950 transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  </Link>
                ) : (
                  <Link href="/sessions">
                    <button
                      type="button"
                      className="group inline-flex items-center justify-between gap-3 rounded-full bg-[#d4e938] hover:bg-[#c3d82f] text-slate-950 font-extrabold text-xs sm:text-sm pl-5 pr-2 py-2 shadow-lg shadow-[#d4e938]/20 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>View Schedule</span>
                      <span className="h-8 w-8 rounded-full bg-slate-950/10 flex items-center justify-center text-slate-950 transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Stadium Telemetry Bento Grid */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 font-mono">
            {/* 1. Arena Mode */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>ARENA STATUS</span>
                <span className={`h-2 w-2 rounded-full ${activeSession ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              </div>
              <div className={`text-base sm:text-lg font-black ${activeSession ? "text-emerald-400" : "text-amber-400"}`}>
                {activeSession ? "LIVE ACTIVE" : "STANDBY"}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {activeSession ? "Rotations Running" : "Awaiting Organizer"}
              </div>
            </div>

            {/* 2. Court Capacity */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>COURT LOAD</span>
                <Activity className="h-3 w-3 text-emerald-400" />
              </div>
              <div className="text-base sm:text-lg font-black text-white">
                {activeCourtsCount} / {totalCourtsCount} Courts
              </div>
              {/* Mini court visual indicator */}
              <div className="flex items-center gap-1 pt-0.5">
                {Array.from({ length: totalCourtsCount || 4 }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full ${
                      idx < activeCourtsCount ? "bg-rose-500" : "bg-emerald-500/60"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 3. Queue Velocity */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>QUEUE ROTATION</span>
                <Users className="h-3 w-3 text-[#d4e938]" />
              </div>
              <div className="text-base sm:text-lg font-black text-[#d4e938]">
                {activeSession ? `${rawQueue.length} in Line` : "0 Waiting"}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {activeSession && rawQueue.length > 0
                  ? `${Math.ceil(rawQueue.length / 4)} Pod${Math.ceil(rawQueue.length / 4) !== 1 ? "s" : ""} on deck`
                  : "Queue open for check-in"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN ARENA CONTENT: Active Session (Live Court Matrix + Queue) OR Standby Club Lounge */}
      {activeSession ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <CourtMatrix
              initialCourts={courts}
              userRole={authData?.profile?.role || "player"}
              isAdmin={isAdmin}
              readOnly={true}
              sessionId={activeSession?.id}
              queue={rawQueue}
              waitingQueueCount={rawQueue.filter((q) => q.status === "waiting").length}
            />
          </div>

          {/* Unified Live Queue Board (Kiosk Read-Only Mode) */}
          <div className="space-y-6">
            <SessionQueueLiveBoard
              initialQueue={rawQueue}
              sessionId={activeSession.id}
              currentUserId={authData?.user?.id}
              userRole={authData?.profile?.role || "player"}
              userEmail={userEmail || ""}
              employees={employees}
              isSessionActive={true}
              readOnly={true}
              matchingMode={activeSessionMeta?.matchingMode}
            />
          </div>
        </div>
      ) : (
        /* STANDBY CLUB LOUNGE (When No Session Is Active) */
        <div className="space-y-8">
          {/* Top 3 Player Leaderboard Spotlight + Upcoming Sessions Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Upcoming Scheduled Open-Play Sessions */}
            <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-6 space-y-5 shadow-sm backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      Upcoming Open Play Sessions
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Scheduled DCTECH community rotations
                    </p>
                  </div>
                </div>

                <Link
                  href="/sessions"
                  className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Full Schedule</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {upcomingSessions.length === 0 ? (
                <div className="py-10 text-center space-y-2 font-mono text-xs text-slate-400">
                  <Calendar className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <div className="text-slate-700 dark:text-slate-300 font-semibold">No upcoming sessions scheduled</div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {isAdmin
                      ? "Use the Admin Panel to schedule the next company open-play session."
                      : "Check back soon for the next scheduled recreation session."}
                  </p>
                  {isAdmin && (
                    <div className="pt-2">
                      <Link href="/admin">
                        <Button variant="volt" size="sm" className="font-bold text-xs">
                          <Zap className="h-3.5 w-3.5 mr-1" />
                          Create Session
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {upcomingSessions.slice(0, 4).map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition-all shadow-2xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40">
                            SCHEDULED
                          </Badge>
                          <span className="text-[11px] font-mono text-slate-500">
                            {new Date(session.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                          {session.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {cleanSessionDescription(session.description) || "DCTECH open play on all arena courts."}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-emerald-500" />
                          {new Date(session.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <Link href={`/sessions/${session.id}`}>
                          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs font-mono font-bold">
                            Details <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Top Leaderboard Podium Preview */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-6 space-y-4 shadow-sm backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      DUPR Standings
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">Top Club Players</p>
                  </div>
                </div>

                <Link
                  href="/rankings"
                  className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  All →
                </Link>
              </div>

              {/* Top 3 Player List */}
              <div className="space-y-2.5 flex-1">
                {topPlayers.map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center font-mono font-extrabold text-xs shadow-2xs ${
                          idx === 0
                            ? "bg-amber-400 text-slate-950"
                            : idx === 1
                            ? "bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                            : "bg-amber-700/60 text-amber-100"
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-28">
                          {player.full_name || player.display_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {player.games_won}W - {player.games_played - player.games_won}L ({player.win_rate}%)
                        </div>
                      </div>
                    </div>

                    <Badge variant="secondary" className="font-mono text-xs font-bold px-2 py-0.5">
                      ★ {formatRating(player.skill_rating)}
                    </Badge>
                  </div>
                ))}
              </div>

              <Link href="/rankings" className="w-full pt-2">
                <Button variant="outline" size="sm" className="w-full font-mono text-xs font-bold h-9">
                  View Full Ranking Ladder ({leaderboard.length} Players) →
                </Button>
              </Link>
            </div>
          </div>

          {/* Bottom Arena Facility Status Strip */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-5 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    All 4 Arena Courts Primed & Calibrated
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Professional court surfaces & referee monitors will activate dynamically upon session launch.
                  </p>
                </div>
              </div>

              {isAdmin ? (
                <Link href="/admin" className="shrink-0">
                  <Button variant="volt" size="sm" className="font-bold font-mono text-xs h-9 px-4">
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Launch Session from Admin Panel
                  </Button>
                </Link>
              ) : (
                <Link href="/sessions" className="shrink-0">
                  <Button variant="default" size="sm" className="font-bold text-xs h-9 px-4">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    View Open-Play Calendar
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
