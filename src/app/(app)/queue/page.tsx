import Link from "next/link";
import { Users, Clock, Zap, Calendar, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getQueueForSession } from "@/features/queue/api/queueActions";
import { getSessions } from "@/features/sessions/api/sessionActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getCourts } from "@/features/courts/api/courtActions";
import { QueueBoard } from "@/features/queue/components/QueueBoard";

export default async function QueuePage() {
  const [authData, sessions, employees, courts] = await Promise.all([
    getCurrentUser(),
    getSessions(),
    getAllEmployees(),
    getCourts(),
  ]);

  const isAdmin = authData?.profile?.role === "admin";
  const activeSession = sessions.find((s) => s.status === "active");

  if (!activeSession) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm text-center py-12 px-6">
          <CardHeader className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Users className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Paddle Queue is Currently Closed
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              The 4-on / 4-off paddle queue activates dynamically once an Administrator starts an active Open-Play Session.
            </p>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              {isAdmin ? (
                <Link href="/admin">
                  <Button variant="volt" size="lg" className="font-bold shadow-sm">
                    <Zap className="h-4 w-4 mr-1.5" />
                    Start Session in Admin Panel
                  </Button>
                </Link>
              ) : (
                <Link href="/sessions">
                  <Button variant="default" size="lg" className="font-bold shadow-sm">
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Browse Session Schedule
                  </Button>
                </Link>
              )}
              <Link href="/rankings">
                <Button variant="outline" size="lg">
                  <Trophy className="h-4 w-4 mr-1.5 text-amber-500" />
                  View Rankings
                </Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const queue = await getQueueForSession(activeSession.id);

  return (
    <QueueBoard
      initialQueue={queue}
      currentUserId={authData?.user?.id || ""}
      userRole={authData?.profile?.role || "player"}
      sessionId={activeSession.id}
      sessionTitle={activeSession.title}
      employees={employees}
      courtCount={courts.length || 3}
    />
  );
}
