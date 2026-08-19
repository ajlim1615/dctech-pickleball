import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { getPlayerMatchHistory } from "@/features/players/api/playerActions";
import { ProfileView } from "@/features/players/components/ProfileView";
import type { Profile } from "@/types";

export default async function ProfilePage() {
  const authData = await getCurrentUser();

  if (!authData?.user) {
    redirect("/login");
  }

  const profile: Profile = authData.profile || {
    id: authData.user.id,
    email: authData.user.email || "player@dctech.com",
    full_name: authData.user.user_metadata?.full_name || "New Player",
    display_name: authData.user.user_metadata?.display_name || "Player",
    avatar_url: null,
    role: "player",
    skill_rating: 3.50,
    games_played: 0,
    games_won: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const matches = await getPlayerMatchHistory(authData.user.id);

  return <ProfileView profile={profile} matches={matches} />;
}
