import { getLeaderboard } from "@/features/rankings/api/rankingActions";
import { getCurrentUser } from "@/features/auth/api/authActions";
import { LeaderboardTable } from "@/features/rankings/components/LeaderboardTable";

export default async function RankingsPage() {
  const [leaderboard, authData] = await Promise.all([getLeaderboard(), getCurrentUser()]);
  return <LeaderboardTable initialRankings={leaderboard} currentUserId={authData?.user?.id} />;
}
