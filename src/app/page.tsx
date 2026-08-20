import Link from "next/link";
import { Calendar, PlayCircle, PlusCircle, ShieldCheck, Clock, Users, ArrowRight, Trophy, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CourtMatrix } from "@/features/courts/components/CourtMatrix";
import { LiveQueueRail } from "@/features/queue/components/LiveQueueRail";
import { getCourts } from "@/features/courts/api/courtActions";
import { getSessions } from "@/features/sessions/api/sessionActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getQueueForSession } from "@/features/queue/api/queueActions";
import { cleanSessionDescription } from "@/lib/utils";

export default async function HomePage() {
  const [courts, sessions, authData] = await Promise.all([
    getCourts(),
    getSessions(),
    getCurrentUser(),
  ]);

  const userEmail = authData?.user?.email || authData?.profile?.email;
  const isSystemAdmin = userEmail?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = authData?.profile?.role === "admin" || isSystemAdmin;
  const activeSession = sessions.find((s) => s.status === "active");
  const upcomingSessions = sessions.filter((s) => s.status === "scheduled");
  const activeCourtsCount = courts.filter((c) => c.status === "occupied").length;
  const totalCourtsCount = courts.length;

  const rawQueue = activeSession ? await getQueueForSession(activeSession.id) : [];
  const waitingQueue = rawQueue.filter((e) => e.status === "waiting");
  const formattedQueue = waitingQueue.map((e, idx) => {
    const minsAgo = Math.max(0, Math.floor((Date.now() - new Date(e.joined_at).getTime()) / 60000));
    return {
      id: e.id,
      position: idx + 1,
      name: e.player?.full_name || e.player?.display_name || "Player",
      rating: e.player?.skill_rating ? Number(e.player.skill_rating).toFixed(2) : "3.00",
      type: (e.group_id ? "Doubles Pair" : "Singles") as "Doubles Pair" | "Singles",
      waitTime: `~${minsAgo}m wait`,
    };
  });

  const activeDescription = cleanSessionDescription(activeSession?.description);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      {/* Session Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={activeSession ? "default" : "secondary"} className="text-xs font-mono">
                {activeSession ? "● ACTIVE SESSION" : "○ ARENA STANDBY"}
              </Badge>
              {activeSession && (
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(activeSession.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
                  {new Date(activeSession.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
              {activeSession ? activeSession.title : "DCTECH Open Play Arena"}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              {activeDescription ||
                "Real-time court rotations and paddle queue activate as soon as an Administrator starts an Open-Play Session."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isSystemAdmin ? (
              <Link href="/admin">
                <Button variant="volt" size="lg" className="shadow-lg shadow-[#d4e938]/10 font-bold">
                  <Zap className="h-4 w-4 mr-1.5" />
                  {activeSession ? "Manage Session in Admin Panel" : "Start Session in Admin Panel"}
                </Button>
              </Link>
            ) : activeSession ? (
              <Link href={`/sessions/${activeSession.id}`}>
                <Button variant="volt" size="lg" className="shadow-lg shadow-[#d4e938]/10 font-bold">
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Check In to Session
                </Button>
              </Link>
            ) : isAdmin ? (
              <Link href="/admin">
                <Button variant="volt" size="lg" className="shadow-lg shadow-[#d4e938]/10 font-bold">
                  <Zap className="h-4 w-4 mr-1.5" />
                  Start Session in Admin Panel
                </Button>
              </Link>
            ) : (
              <Link href="/sessions">
                <Button variant="volt" size="lg" className="font-bold">
                  <PlayCircle className="h-4 w-4 mr-1" />
                  View Schedule
                </Button>
              </Link>
            )}
            {isAdmin ? (
              <Link href="/matches/new">
                <Button
                  size="lg"
                  className="border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-semibold shadow-sm transition-all"
                >
                  <PlusCircle className="h-4 w-4 mr-1 text-emerald-400" />
                  Record Score
                </Button>
              </Link>
            ) : (
              <Link href="/rankings">
                <Button
                  size="lg"
                  className="border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-semibold shadow-sm transition-all"
                >
                  <Trophy className="h-4 w-4 mr-1 text-amber-400" />
                  Leaderboard
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
          <div className="rounded-lg bg-slate-950/40 p-2.5 border border-slate-800/50">
            <div className="text-xs text-slate-400">SESSION STATUS</div>
            <div className={`text-xl font-bold ${activeSession ? "text-emerald-400" : "text-amber-400"}`}>
              {activeSession ? "LIVE IN PLAY" : "STANDBY"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/40 p-2.5 border border-slate-800/50">
            <div className="text-xs text-slate-400">FACILITY COURTS</div>
            <div className="text-xl font-bold text-slate-100">
              {totalCourtsCount} {totalCourtsCount === 1 ? "Court" : "Courts"}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/40 p-2.5 border border-slate-800/50">
            <div className="text-xs text-slate-400">ACTIVE ROTATIONS</div>
            <div className="text-xl font-bold text-emerald-400">
              {activeSession ? `${activeCourtsCount} / ${totalCourtsCount}` : "0 / " + totalCourtsCount}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/40 p-2.5 border border-slate-800/50">
            <div className="text-xs text-slate-400">VENUE</div>
            <div className="text-xl font-bold text-[#d4e938] truncate px-1">
              {activeSession?.location || "DCTECH Sports Arena"}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area: Live Courts (When Session Active) OR Arena Standby (When No Session) */}
      {activeSession ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <CourtMatrix
              initialCourts={courts}
              userRole={authData?.profile?.role || "player"}
              sessionId={activeSession?.id}
            />
          </div>
          <div className="space-y-6">
            <LiveQueueRail queue={formattedQueue} userEmail={userEmail || ""} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
            <CardHeader className="text-center py-10 space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Clock className="h-7 w-7" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                No Active Open-Play Session
              </CardTitle>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                Live court matrices, scoreboards, and FIFO paddle queue rotations will appear here as soon as an Administrator starts a session.
              </p>
              
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                {isAdmin ? (
                  <Link href="/admin">
                    <Button variant="volt" size="lg" className="font-bold shadow-sm">
                      <Zap className="h-4 w-4 mr-1.5" />
                      Start Open-Play Session (Admin Panel)
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sessions">
                    <Button variant="default" size="lg" className="font-bold shadow-sm">
                      <Calendar className="h-4 w-4 mr-1.5" />
                      View Session Schedule
                    </Button>
                  </Link>
                )}
                <Link href="/rankings">
                  <Button variant="outline" size="lg">
                    <Trophy className="h-4 w-4 mr-1.5 text-amber-500" />
                    Leaderboard & DUPR Rankings
                  </Button>
                </Link>
              </div>
            </CardHeader>

            {upcomingSessions.length > 0 && (
              <CardContent className="border-t border-slate-200 dark:border-slate-800/80 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-500" />
                    Upcoming Scheduled Sessions
                  </h3>
                  <Link href="/sessions" className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:underline">
                    View All →
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upcomingSessions.slice(0, 2).map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{s.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {new Date(s.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} •{" "}
                          {new Date(s.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      <Link href={`/sessions/${s.id}`}>
                        <Button variant="outline" size="sm" className="text-xs font-mono">
                          Details <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
