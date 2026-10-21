import { computeSessionLeaderboard, type SessionRankedPlayer } from "@/features/sessions/utils/sessionLeaderboard";
import type { SessionState } from "./types";

/** The online leaderboard, fed with this session's finished games. */
export function sessionLeaderboard(state: SessionState): SessionRankedPlayer[] {
  const profile = (id: string) => {
    const p = state.players[id];
    return { id, full_name: p?.name ?? "Player", display_name: p?.name ?? "Player", skill_rating: p?.skill ?? 3.0 };
  };
  const matches = state.games
    .filter((g) => g.endedAt && g.winner)
    .map((g) => ({
      status: "completed",
      team_a_score: g.scoreA ?? 0,
      team_b_score: g.scoreB ?? 0,
      winning_team: g.winner === "A" ? "team_a" : "team_b",
      players: [
        ...g.teamA.map((id) => ({ team: "team_a", player: profile(id) })),
        ...g.teamB.map((id) => ({ team: "team_b", player: profile(id) })),
      ],
    }));
  const checkins = state.queue.map((q) => profile(q.playerId));
  return computeSessionLeaderboard(matches, checkins);
}
