import { getSessions } from "@/features/sessions/api/sessionActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { SessionList } from "@/features/sessions/components/SessionList";

export default async function SessionsPage() {
  const [sessions, authData] = await Promise.all([
    getSessions(),
    getCurrentUser(),
  ]);

  return (
    <SessionList
      initialSessions={sessions}
      userRole={authData?.profile?.role || "player"}
    />
  );
}
