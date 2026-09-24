import {
  getSessionById,
  getSessionMatches,
} from "@/features/sessions/api/sessionActions";
import { computeSessionLeaderboard } from "@/features/sessions/utils/sessionLeaderboard";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getCourts } from "@/features/courts/api/courtActions";
import { getQueueForSession } from "@/features/queue/api/queueActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { SessionDetailView } from "@/features/sessions/components/SessionDetailView";
import type { Session } from "@/types";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sessionData, authData, courts, matches, queue, employees] = await Promise.all([
    getSessionById(id),
    getCurrentUser(),
    getCourts(),
    getSessionMatches(id),
    getQueueForSession(id),
    getAllEmployees(),
  ]);

  const leaderboard = computeSessionLeaderboard(
    matches,
    (sessionData?.checkins || []) as any
  );

  // Fallback demo session if running locally without connected DB
  const session: Session & { checkins?: any[] } = sessionData || {
    id,
    title: "Wednesday Night Open Play",
    description: "Indoor Courts at DCTECH Sports Arena. 4-on / 4-off paddle rotation queue active.",
    location: "DCTECH Sports Arena",
    status: "active",
    start_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    end_time: new Date(Date.now() + 1000 * 60 * 120).toISOString(),
    max_players: 32,
    created_by: "system",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    checkins: [],
  };

  return (
    <SessionDetailView
      session={session}
      userRole={authData?.profile?.role || "player"}
      userEmail={authData?.user?.email || authData?.profile?.email || ""}
      currentUserId={authData?.user?.id}
      courts={courts}
      initialLeaderboard={leaderboard}
      initialMatches={matches}
      initialQueue={queue}
      employees={employees}
    />
  );
}
