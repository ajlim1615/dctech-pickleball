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
import { getSessions, getSessionMatches } from "@/features/sessions/api/sessionActions";
import { getMyRsvpSessionIds, getRsvpCounts } from "@/features/sessions/api/rsvpActions";
import { RsvpButton } from "@/features/sessions/components/RsvpButton";
import { CourtsBadge, RankedBadge } from "@/features/sessions/components/RankedBadge";
import { pastGamesFromMatches, type MatchRowForHistory } from "@/features/queue/api/matchmakingData";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { RATING_RULES } from "@/features/rankings/ratingConfig";
import { getLeaderboard } from "@/features/rankings/api/rankingActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getQueueForSession } from "@/features/queue/api/queueActions";
import { getVenues } from "@/features/venues/api/venueActions";
import { VenueLocationLink } from "@/features/venues/components/VenueLocationLink";
import { cleanSessionDescription, formatRating, parseSessionMetadata } from "@/lib/utils";
import { DEFAULT_COURT_COUNT } from "@/lib/constants";
import { formatPHTDate, formatPHTTime } from "@/lib/timezone";

export default async function HomePage() {
  const [courts, sessions, authData, leaderboard, venues] = await Promise.all([
    getCourts(),
    getSessions(),
    getCurrentUser(),
    getLeaderboard(),
    getVenues(),
  ]);

  const userEmail = authData?.user?.email || authData?.profile?.email;
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = authData?.profile?.role === "admin" || isSystemAdmin;
  const activeSession = sessions.find((s) => s.status === "active");
  const activeSessionMeta = activeSession ? parseSessionMetadata(activeSession.description) : null;
  const upcomingSessions = sessions
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  // When nothing is live, the hero leads with the next scheduled session.
  const nextSession = activeSession ? null : upcomingSessions[0] ?? null;
  const heroSession = activeSession ?? nextSession;
  const activeCourtsCount = courts.filter((c) => c.status === "occupied").length;
  // Live: the courts in use. Not started: the courts the next session will run on.
  const totalCourtsCount = activeSession
    ? courts.length
    : nextSession
      ? parseSessionMetadata(nextSession.description).courtCount ?? DEFAULT_COURT_COUNT
      : courts.length;

  // Only fetch full employee roster and live queue if an active session is in play
  const [employees, rawQueue, sessionMatches] = activeSession
    ? await Promise.all([
        getAllEmployees(),
        getQueueForSession(activeSession.id),
        getSessionMatches(activeSession.id),
      ])
    : [[], [], []];

  // RSVP head counts for upcoming sessions, and the ones this viewer is going to
  const upcomingIds = upcomingSessions.map((s) => s.id);
  const [rsvpCounts, myRsvps] = await Promise.all([getRsvpCounts(upcomingIds), getMyRsvpSessionIds(upcomingIds)]);

  const heroDescription = cleanSessionDescription(heroSession?.description);

  // Top 3 players from leaderboard
  const topPlayers = (leaderboard || []).filter((p) => p.qualified).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8 pb-24 sm:pb-12">
      {/* STADIUM ATMOSPHERE HERO (Double-Bezel Architecture) */}
      <section className="relative rounded-[2rem] p-1.5 sm:p-2 border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-[#070b12] text-white shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Subtle Ambient Stadium Radial Glow + Faint Court Lines */}
        <div className="pointer-events-none absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-[#d4e938]/10 blur-3xl" />
        <svg
          aria-hidden="true"
          viewBox="0 0 400 220"
          fill="none"
          className="pointer-events-none absolute -right-10 -top-6 h-56 w-80 text-emerald-400/[0.07] rotate-[-10deg]"
        >
          <rect x="8" y="8" width="384" height="204" rx="8" stroke="currentColor" strokeWidth="2" />
          <line x1="140" y1="8" x2="140" y2="212" stroke="currentColor" strokeWidth="1.75" />
          <line x1="260" y1="8" x2="260" y2="212" stroke="currentColor" strokeWidth="1.75" />
          <line x1="200" y1="0" x2="200" y2="220" stroke="currentColor" strokeWidth="2" strokeDasharray="6 5" />
          <line x1="8" y1="110" x2="140" y2="110" stroke="currentColor" strokeWidth="1.5" />
          <line x1="260" y1="110" x2="392" y2="110" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Inner Core */}
        <div className="relative z-10 rounded-[1.6rem] border border-white/10 bg-slate-950/60 p-4 sm:p-7 space-y-5 sm:space-y-6">
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
              ) : nextSession ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d4e938]/40 bg-lime-950/40 px-3.5 py-1 text-xs font-mono font-extrabold text-[#d4e938] shadow-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>UP NEXT • {formatPHTDate(nextSession.start_time).toUpperCase()}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/60 px-3.5 py-1 text-xs font-mono font-extrabold text-amber-400 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                  <span>ARENA STANDBY • NO SESSION SCHEDULED</span>
                </div>
              )}

              {heroSession && <RankedBadge description={heroSession.description} onDark />}
              {heroSession && (
                <CourtsBadge
                  description={heroSession.description}
                  count={activeSession ? courts.length : undefined}
                  onDark
                />
              )}

              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <VenueLocationLink
                  location={heroSession?.location || "DCTECH Sports Arena"}
                  venueId={heroSession?.venue_id}
                  venues={venues}
                  className="hover:text-emerald-300"
                />
              </span>
            </div>

            {heroSession ? (
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  {formatPHTTime(heroSession.start_time)} –{" "}
                  {formatPHTTime(heroSession.end_time)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Hero Main Content & Nested CTA Hub */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight text-balance">
                {heroSession ? heroSession.title : "DCTECH Open Play & Arena Matrix"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                {heroDescription ||
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
                  <>
                  {/* Playing admins get in the line the same way as everyone else. */}
                  {nextSession && !isSystemAdmin && (
                    <RsvpButton
                      variant="dark"
                      sessionId={nextSession.id}
                      going={myRsvps.includes(nextSession.id)}
                      count={rsvpCounts[nextSession.id] || 0}
                    />
                  )}
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
                  </>
                ) : (
                  <>
                  {nextSession && (
                    <RsvpButton
                      variant="dark"
                      sessionId={nextSession.id}
                      going={myRsvps.includes(nextSession.id)}
                      count={rsvpCounts[nextSession.id] || 0}
                    />
                  )}
                  <Link href={nextSession ? `/sessions/${nextSession.id}` : "/sessions"}>
                    <button
                      type="button"
                      className="group inline-flex items-center justify-between gap-3 rounded-full bg-[#d4e938] hover:bg-[#c3d82f] text-slate-950 font-extrabold text-xs sm:text-sm pl-5 pr-2 py-2 shadow-lg shadow-[#d4e938]/20 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>{nextSession ? "View Session" : "View Schedule"}</span>
                      <span className="h-8 w-8 rounded-full bg-slate-950/10 flex items-center justify-center text-slate-950 transition-transform group-hover:translate-x-0.5">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  </Link>
                  </>
                )
              )}
            </div>
          </div>

          {/* Stadium Telemetry Bento Grid */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 font-mono">
            {/* 1. Session Status */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-colors p-3.5 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>SESSION STATUS</span>
                <span className={`h-2 w-2 rounded-full ${activeSession ? "bg-emerald-400 animate-pulse" : nextSession ? "bg-[#d4e938]" : "bg-amber-400"}`} />
              </div>
              <div className={`text-base sm:text-lg font-black ${activeSession ? "text-emerald-400" : nextSession ? "text-[#d4e938]" : "text-amber-400"}`}>
                {activeSession ? "LIVE NOW" : nextSession ? "UP NEXT" : "STANDBY"}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {activeSession
                  ? "Matches in progress"
                  : nextSession
                    ? `${formatPHTDate(nextSession.start_time)} · ${formatPHTTime(nextSession.start_time)}`
                    : "No session scheduled yet"}
              </div>
            </div>

            {/* 2. Courts */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-colors p-3.5 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>COURTS</span>
                <Activity className="h-3 w-3 text-emerald-400" />
              </div>
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {activeSession
                  ? `${activeCourtsCount} / ${totalCourtsCount} In Use`
                  : `${totalCourtsCount} Ready`}
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

            {/* 3. Queue / RSVP Velocity */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-colors p-3.5 space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>{activeSession ? "QUEUE ROTATION" : "NEXT SESSION RSVPS"}</span>
                <Users className="h-3 w-3 text-[#d4e938]" />
              </div>
              <div className="text-base sm:text-lg font-black text-[#d4e938] tabular-nums">
                {activeSession
                  ? `${rawQueue.length} in Line`
                  : nextSession
                    ? `${rsvpCounts[nextSession.id] || 0} Going`
                    : "0 Waiting"}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {activeSession && rawQueue.length > 0
                  ? `${Math.ceil(rawQueue.length / 4)} Pod${Math.ceil(rawQueue.length / 4) !== 1 ? "s" : ""} on deck`
                  : nextSession
                    ? "RSVP open before check-in"
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
              targetPoints={activeSessionMeta?.targetPoints}
              winByTwo={activeSessionMeta?.winByTwo}
              trackScores={activeSessionMeta?.trackScores}
              courtNames={activeSessionMeta?.courtNames}
              syncArenaList={true}
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
              courts={courts}
              history={pastGamesFromMatches(sessionMatches as unknown as MatchRowForHistory[])}
              skillSpread={activeSessionMeta?.skillSpread}
              allowPartners={activeSessionMeta?.allowPartners}
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
                  {upcomingSessions.slice(0, 4).map((session, idx) => {
                    const isNextUp = idx === 0;
                    const goingCount = rsvpCounts[session.id] || 0;
                    const isGoing = myRsvps.includes(session.id);

                    return (
                      <div
                        key={session.id}
                        className={`group rounded-2xl border p-4 flex flex-col justify-between gap-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm shadow-2xs ${
                          isNextUp
                            ? "border-emerald-400/50 dark:border-emerald-500/35 bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-950/25 dark:via-slate-950/75 dark:to-slate-950/60"
                            : "border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-emerald-500/40"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-mono ${
                                  isNextUp
                                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60"
                                    : "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
                                }`}
                              >
                                {isNextUp ? "UP NEXT" : "SCHEDULED"}
                              </Badge>
                              <RankedBadge description={session.description} />
                              <CourtsBadge description={session.description} />
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <Clock className="h-3 w-3 text-emerald-500" />
                              {formatPHTTime(session.start_time)}
                            </span>
                          </div>

                          <div>
                            <Link href={`/sessions/${session.id}`} className="block">
                              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {session.title}
                              </h4>
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-emerald-500 shrink-0" />
                                {formatPHTDate(session.start_time)}
                              </span>
                              <span className="inline-flex items-center gap-1 truncate max-w-44">
                                <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span className="truncate">{session.location || "DCTECH Sports Arena"}</span>
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {cleanSessionDescription(session.description) || "DCTECH open play on all arena courts."}
                          </p>
                        </div>

                        <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            {!isSystemAdmin && (
                              <RsvpButton
                                sessionId={session.id}
                                going={isGoing}
                                count={goingCount}
                              />
                            )}
                            {goingCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                <Users className="h-3 w-3 text-emerald-500" />
                                {goingCount} going
                              </span>
                            )}
                          </div>

                          <Link href={`/sessions/${session.id}`}>
                            <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-mono font-bold">
                              Details <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
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
                      Top Players
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">Highest ratings right now</p>
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
                {topPlayers.length === 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono py-6 text-center">
                    {`No one is ranked yet. Players need ${RATING_RULES.qualifyGames} ranked games.`}
                  </p>
                )}
                {topPlayers.map((player) => {
                  const name = player.full_name || player.display_name || "Player";
                  const initials = name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? "")
                    .join("");
                  const isFirst = player.rank === 1;
                  const isSecond = player.rank === 2;
                  const cardTone = isFirst
                    ? "border-amber-400/45 dark:border-amber-500/35 bg-gradient-to-r from-amber-50/90 via-white to-white dark:from-amber-950/30 dark:via-slate-950/75 dark:to-slate-950/60"
                    : isSecond
                    ? "border-slate-300/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-950/70"
                    : "border-orange-300/50 dark:border-orange-900/50 bg-orange-50/40 dark:bg-slate-950/60";
                  const rankPillTone = isFirst
                    ? "bg-amber-400 text-slate-950 ring-2 ring-white dark:ring-slate-900"
                    : isSecond
                    ? "bg-slate-300 text-slate-900 dark:bg-slate-600 dark:text-white ring-2 ring-white dark:ring-slate-900"
                    : "bg-amber-700 text-amber-50 ring-2 ring-white dark:ring-slate-900";
                  const avatarRingTone = isFirst
                    ? "ring-2 ring-amber-400/80"
                    : isSecond
                    ? "ring-2 ring-slate-300 dark:ring-slate-600"
                    : "ring-2 ring-amber-700/60";

                  return (
                    <Link
                      key={player.id}
                      href="/rankings"
                      title={player.tied ? `Tied for #${player.rank} — View full rankings` : `Rank #${player.rank} — View full rankings`}
                      className={`group flex items-center justify-between gap-3 p-3 rounded-2xl border shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-sm ${cardTone}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar + Rank Badge */}
                        <div className="relative shrink-0">
                          <div
                            className={`h-10 w-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-extrabold text-xs text-slate-700 dark:text-slate-200 ${avatarRingTone}`}
                          >
                            {player.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.avatar_url}
                                alt=""
                                width={40}
                                height={40}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              initials || "P"
                            )}
                          </div>
                          <span
                            className={`absolute -bottom-1 -right-1 h-5 min-w-5 px-1 rounded-full flex items-center justify-center font-mono font-black text-[10px] shadow-xs ${rankPillTone}`}
                          >
                            {player.tied ? "T" : "#"}{player.rank}
                          </span>
                        </div>

                        {/* Name + Record + Win-Rate Micro-Bar */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
                              {player.games_won}W-{player.games_lost}L · {player.win_rate}%
                            </span>
                            <div className="hidden sm:block h-1.5 flex-1 max-w-16 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isFirst ? "bg-amber-400" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.max(8, Math.min(100, player.win_rate))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant={isFirst ? "volt" : "secondary"}
                        className="font-mono text-xs font-extrabold tabular-nums px-2.5 py-1 shrink-0"
                      >
                        ★ {formatRating(player.skill_rating)}
                      </Badge>
                    </Link>
                  );
                })}
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
