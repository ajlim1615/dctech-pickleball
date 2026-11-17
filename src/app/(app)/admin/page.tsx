import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getSessions } from "@/features/sessions/api/sessionActions";
import { getCourts } from "@/features/courts/api/courtActions";
import { getVenues } from "@/features/venues/api/venueActions";
import { AdminDashboard } from "@/features/admin/components/AdminDashboard";
import { getRsvpCounts } from "@/features/sessions/api/rsvpActions";

export default async function AdminPage() {
  const authData = await getCurrentUser();

  const isSystemAdmin = authData?.user?.email?.toLowerCase() === "admin@dctechmicro.com";
  const isAdmin = authData?.profile?.role === "admin" || isSystemAdmin;

  // If not logged in or not an admin, redirect away from Admin panel immediately
  if (!isAdmin) {
    redirect("/");
  }

  const [employees, sessions, courts, venues] = await Promise.all([
    getAllEmployees(),
    getSessions(),
    getCourts(),
    getVenues(),
  ]);
  const rsvpCounts = await getRsvpCounts(sessions.filter((s) => s.status === "scheduled").map((s) => s.id));


  return (
    <AdminDashboard
      initialEmployees={employees}
      initialSessions={sessions}
      initialCourts={courts}
      initialVenues={venues}
      rsvpCounts={rsvpCounts}
      isSystemAdmin={isSystemAdmin}
    />
  );
}
