import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { ScoreRecorder } from "@/features/matches/components/ScoreRecorder";
import { getCourts } from "@/features/courts/api/courtActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getSessions } from "@/features/sessions/api/sessionActions";
import { getQueueForSession } from "@/features/queue/api/queueActions";

export default async function RecordScorePage() {
  const authData = await getCurrentUser();

  // Only Admins can manually record match scores
  if (authData?.profile?.role !== "admin") {
    redirect("/");
  }

  const [courts, employees, sessions] = await Promise.all([
    getCourts(),
    getAllEmployees(),
    getSessions(),
  ]);

  const activeSession = sessions.find((s) => s.status === "active") || sessions[0];
  const queue = activeSession ? await getQueueForSession(activeSession.id) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
              ● ADMIN COURT & SCORE RECORDER
            </span>
            {activeSession && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {activeSession.title}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Live Courts & Match Scoring
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage individual court games, monitor who is up next to play, and submit official match scores.
          </p>
        </div>
      </div>

      <ScoreRecorder
        courts={courts}
        players={employees}
        sessionId={activeSession?.id}
        initialQueue={queue}
      />
    </div>
  );
}

