import { getLeaderboard } from "@/features/rankings/api/rankingActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { LeaderboardTable } from "@/features/rankings/components/LeaderboardTable";

export default async function RankingsPage() {
  const [leaderboard, authData] = await Promise.all([getLeaderboard(), getCurrentUser()]);
  const isAdmin =
    authData?.profile?.role === "admin" || authData?.user?.email?.toLowerCase() === "admin@dctechmicro.com";
  return <LeaderboardTable initialRankings={leaderboard} isAdmin={isAdmin} />;
}
