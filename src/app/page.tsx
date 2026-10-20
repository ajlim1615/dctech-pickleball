import { getCourts } from "@/features/courts/api/courtActions";
import { getSessions } from "@/features/sessions/api/sessionActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getLeaderboard } from "@/features/rankings/api/rankingActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getQueueForSession } from "@/features/queue/api/queueActions";
import { getMyRsvpSessionIds, getRsvpCounts } from "@/features/sessions/api/rsvpActions";
import { HomeView } from "@/features/home/components/HomeView";

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
  const activeSession = sessions.find((s) => s.status === "active") || null;
  const upcomingSessions = sessions
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Only fetch the roster and live queue while a session is in play
  const [employees, queue] = activeSession
    ? await Promise.all([getAllEmployees(), getQueueForSession(activeSession.id)])
    : [[], []];
  const upcomingIds = upcomingSessions.map((s) => s.id);
  const [rsvpCounts, myRsvps] = await Promise.all([getRsvpCounts(upcomingIds), getMyRsvpSessionIds(upcomingIds)]);

  return (
    <HomeView
      activeSession={activeSession}
      upcomingSessions={upcomingSessions}
      courts={courts}
      queue={queue}
      employees={employees}
      leaderboard={leaderboard || []}
      rsvpCounts={rsvpCounts}
      myRsvps={myRsvps}
      viewer={{
        id: authData?.user?.id,
        email: userEmail,
        role: authData?.profile?.role || "player",
        isAdmin,
      }}
    />
  );
}
