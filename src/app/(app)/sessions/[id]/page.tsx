import {
  getSessionById,
  getSessionMatches,
} from "@/features/sessions/api/sessionActions";
import { computeSessionLeaderboard } from "@/features/sessions/utils/sessionLeaderboard";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getCourts } from "@/features/courts/api/courtActions";
import { getMyQueueLimits, getQueueForSession } from "@/features/queue/api/queueActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { pastGamesFromMatches, type MatchRowForHistory } from "@/features/queue/api/matchmakingData";
import { SessionDetailView } from "@/features/sessions/components/SessionDetailView";
import { getSessionRsvps } from "@/features/sessions/api/rsvpActions";
import { getAverageGameMinutes, getSessionFeed } from "@/features/activity/api/activityActions";
import { getVenues } from "@/features/venues/api/venueActions";
import type { Session } from "@/types";

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string | string[] }>;
}) {
  const { id } = await params;
  // The admin dashboard's Start sends ?start=1 to open "Who's here?" right away.
  const openStart = (await searchParams).start === "1";
  const [sessionData, authData, courts, matches, queue, employees, rsvps, initialEvents, avgGameMinutes, queueLimits, venues] = await Promise.all([
    getSessionById(id),
    getCurrentUser(),
    getCourts(),
    getSessionMatches(id),
    getQueueForSession(id),
    getAllEmployees(),
    getSessionRsvps(id),
    getSessionFeed(id, 500),
    getAverageGameMinutes(id),
    getMyQueueLimits(id),
    getVenues(),
  ]);

  const leaderboard = computeSessionLeaderboard(
    matches,
    (sessionData?.checkins || []) as any
  );

  // Fallback demo session if running locally without connected DB
  const session: Session & { checkins?: any[]; checkedOutCount?: number } = sessionData || {
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
      history={pastGamesFromMatches(matches as unknown as MatchRowForHistory[])}
      employees={employees}
      rsvps={rsvps}
      initialEvents={initialEvents}
      avgGameMinutes={avgGameMinutes}
      queueLimits={queueLimits}
      venues={venues}
      openStart={openStart}
    />
  );
}
