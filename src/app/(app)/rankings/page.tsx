import { getLeaderboard } from "@/features/rankings/api/rankingActions";
import { LeaderboardTable } from "@/features/rankings/components/LeaderboardTable";

export default async function RankingsPage() {
  const leaderboard = await getLeaderboard();
  return <LeaderboardTable initialRankings={leaderboard} />;
}
