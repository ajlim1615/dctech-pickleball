import { getLeaderboard } from "@/features/rankings/api/rankingActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { LeaderboardTable } from "@/features/rankings/components/LeaderboardTable";
import { isRootSystemAdmin } from "@/lib/security/authGuard";

export default async function RankingsPage() {
  const [leaderboard, authData] = await Promise.all([getLeaderboard(), getCurrentUser()]);
  // Only the System Admin can remove a player's photo.
  const canRemovePhotos = isRootSystemAdmin(authData?.user?.email);
  return <LeaderboardTable initialRankings={leaderboard} canRemovePhotos={canRemovePhotos} />;
}
