import { getSessionById } from "@/features/sessions/api/sessionActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getCourts } from "@/features/courts/api/courtActions";
import { SessionDetailView } from "@/features/sessions/components/SessionDetailView";
import type { Session } from "@/types";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sessionData, authData, courts] = await Promise.all([
    getSessionById(id),
    getCurrentUser(),
    getCourts(),
  ]);

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
      currentUserId={authData?.user?.id}
      courts={courts}
    />
  );
}
