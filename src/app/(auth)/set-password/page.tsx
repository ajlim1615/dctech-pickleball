import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/features/auth/components/SetPasswordForm";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (user.app_metadata?.must_change_password !== true) redirect("/");

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4 sm:p-6 lg:p-8">
      <SetPasswordForm email={user.email} />
    </div>
  );
}
