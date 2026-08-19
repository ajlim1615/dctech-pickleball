import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { StaffCourtMonitor } from "@/features/courts/components/StaffCourtMonitor";
import { getCourts } from "@/features/courts/api/courtActions";
import { getAllEmployees } from "@/features/admin/api/adminActions";
import { getSessions } from "@/features/sessions/api/sessionActions";

export default async function CourtMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authData = await getCurrentUser();

  // Restrict referee / umpire scoring controls to admins / staff
  if (!authData || authData.profile?.role !== "admin") {
    redirect("/");
  }

  const { id } = await params;
  const [courts, employees, sessions] = await Promise.all([
    getCourts(),
    getAllEmployees(),
    getSessions(),
  ]);

  const court =
    courts.find((c) => c.id === id) ||
    courts.find((c) => c.name.toLowerCase().includes(id.toLowerCase())) ||
    null;

  const activeSession = sessions.find((s) => s.status === "active") || sessions[0];

  return (
    <StaffCourtMonitor
      courtId={id}
      courtName={court ? court.name.replace(/\s*\(Rented Court\)/i, "") : `Court ${id}`}
      court={court}
      employees={employees}
      sessionId={activeSession?.id}
    />
  );
}
