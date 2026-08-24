import { getMatchesList } from "@/features/matches/api/matchActions";
import { MatchHistoryList } from "@/features/matches/components/MatchHistoryList";

export default async function MatchesPage() {
  const matches = await getMatchesList(40);
  return <MatchHistoryList initialMatches={matches} />;
}
