import { getSessions } from "@/features/sessions/api/sessionActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getMyRsvpSessionIds, getRsvpCounts } from "@/features/sessions/api/rsvpActions";
import { getVenues } from "@/features/venues/api/venueActions";
import { SessionList } from "@/features/sessions/components/SessionList";

export default async function SessionsPage() {
  const [sessions, authData, venues] = await Promise.all([getSessions(), getCurrentUser(), getVenues()]);
  const upcomingIds = sessions.filter((s) => s.status === "scheduled").map((s) => s.id);
  const [rsvpCounts, myRsvps] = await Promise.all([getRsvpCounts(upcomingIds), getMyRsvpSessionIds(upcomingIds)]);

  return (
    <SessionList
      initialSessions={sessions}
      venues={venues}
      userRole={authData?.profile?.role || "player"}
      rsvpCounts={rsvpCounts}
      myRsvps={myRsvps}
      isSystemAdmin={authData?.user?.email?.toLowerCase() === "admin@dctechmicro.com"}
    />
  );
}
