import { getSessions } from "@/features/sessions/api/sessionActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getMyRsvpSessionIds, getRsvpCounts } from "@/features/sessions/api/rsvpActions";
import { SessionList } from "@/features/sessions/components/SessionList";

export default async function SessionsPage() {
  const [sessions, authData] = await Promise.all([getSessions(), getCurrentUser()]);
  const upcomingIds = sessions.filter((s) => s.status === "scheduled").map((s) => s.id);
  const [rsvpCounts, myRsvps] = await Promise.all([getRsvpCounts(upcomingIds), getMyRsvpSessionIds(upcomingIds)]);

  return (
    <SessionList
      initialSessions={sessions}
      userRole={authData?.profile?.role || "player"}
      rsvpCounts={rsvpCounts}
      myRsvps={myRsvps}
    />
  );
}
