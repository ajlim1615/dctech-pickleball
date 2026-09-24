import type { Profile } from "@/types";

export type MatchingStyle =
  | "balanced"
  | "social_mixer"
  | "skill_separated"
  | "winners_losers"
  | "skill_courts"
  | "mixed_doubles"
  | "king_queen"
  | "club_wars"
  | "fifo"
  | "winners_stay";

export interface TeamMatchup {
  teamA: Profile[];
  teamB: Profile[];
  teamARatingAvg: number;
  teamBRatingAvg: number;
  ratingDelta: number;
  balanceScorePercent: number;
  style: MatchingStyle;
}

/**
 * Creates a balanced 2v2 pickleball matchup from 4 players based on the selected matching style.
 */
export function createMatchupFromPod(
  players: Profile[],
  style: MatchingStyle = "balanced",
  previousWinners: Profile[] = []
): TeamMatchup {
  if (players.length === 0) {
    return {
      teamA: [],
      teamB: [],
      teamARatingAvg: 0,
      teamBRatingAvg: 0,
      ratingDelta: 0,
      balanceScorePercent: 100,
      style,
    };
  }

  let teamA: Profile[] = [];
  let teamB: Profile[] = [];

  if (players.length < 4) {
    // Partial pod (e.g. 2 or 3 players)
    teamA = [players[0]].filter(Boolean);
    teamB = players.slice(1);
  } else {
    // 4 Players available
    switch (style) {
      case "skill_separated":
      case "skill_courts":
      case "balanced": {
        // Sort descending by skill rating: P1 (highest), P2, P3, P4 (lowest)
        const sorted = [...players].sort((a, b) => (b.skill_rating || 3.0) - (a.skill_rating || 3.0));
        // Team A: Best (1) + Lowest (4)
        // Team B: Middle two (2 + 3)
        teamA = [sorted[0], sorted[3]];
        teamB = [sorted[1], sorted[2]];
        break;
      }

      case "winners_losers":
      case "winners_stay":
      case "king_queen": {
        if (previousWinners.length >= 2) {
          // Split previous 2 winners and pair them with 2 new challengers
          const w1 = previousWinners[0];
          const w2 = previousWinners[1];
          const challengers = players.filter((p) => p.id !== w1.id && p.id !== w2.id);
          const sortedChallengers = [...challengers].sort(
            (a, b) => (b.skill_rating || 3.0) - (a.skill_rating || 3.0)
          );
          const w1Rating = w1.skill_rating || 3.0;
          const w2Rating = w2.skill_rating || 3.0;

          // Balance pairing: stronger winner gets the lower rated challenger
          if (w1Rating >= w2Rating) {
            teamA = [w1, sortedChallengers[1] || sortedChallengers[0] || challengers[0]];
            teamB = [w2, sortedChallengers[0] || challengers[1]];
          } else {
            teamA = [w1, sortedChallengers[0] || challengers[0]];
            teamB = [w2, sortedChallengers[1] || sortedChallengers[0] || challengers[1]];
          }
        } else {
          // Fallback to balanced DUPR
          const sorted = [...players].sort((a, b) => (b.skill_rating || 3.0) - (a.skill_rating || 3.0));
          teamA = [sorted[0], sorted[3]];
          teamB = [sorted[1], sorted[2]];
        }
        break;
      }

      case "social_mixer":
      case "club_wars":
      case "mixed_doubles": {
        // True Fisher-Yates shuffle for unbiased uniform distribution
        const shuffled = [...players];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        teamA = [shuffled[0], shuffled[1]];
        teamB = [shuffled[2], shuffled[3]];
        break;
      }

      case "fifo":
      default: {
        // Classic paddle rack: First two vs Next two
        teamA = [players[0], players[1]];
        teamB = [players[2], players[3]];
        break;
      }
    }
  }

  const teamARatings = teamA.map((p) => p.skill_rating || 3.0);
  const teamBRatings = teamB.map((p) => p.skill_rating || 3.0);

  const teamARatingAvg =
    teamARatings.length > 0
      ? Number((teamARatings.reduce((sum, r) => sum + r, 0) / teamARatings.length).toFixed(2))
      : 0;

  const teamBRatingAvg =
    teamBRatings.length > 0
      ? Number((teamBRatings.reduce((sum, r) => sum + r, 0) / teamBRatings.length).toFixed(2))
      : 0;

  const ratingDelta = Number(Math.abs(teamARatingAvg - teamBRatingAvg).toFixed(2));
  // 0.00 delta -> 100% balance, 1.00+ delta -> <= 50% balance
  const balanceScorePercent = Math.max(10, Math.min(100, Math.round(100 - ratingDelta * 40)));

  return {
    teamA,
    teamB,
    teamARatingAvg,
    teamBRatingAvg,
    ratingDelta,
    balanceScorePercent,
    style,
  };
}
