import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { ScoreRecorder } from "@/features/matches/components/ScoreRecorder";
import { getCourts } from "@/features/courts/api/courtActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getSessions } from "@/features/sessions/api/sessionActions";

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          Record Match Score (Admin Only)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Log points and submit official match results for employee DUPR rating calculations
        </p>
      </div>

      <ScoreRecorder
        courts={courts}
        players={employees}
        sessionId={activeSession?.id}
      />
    </div>
  );
}
