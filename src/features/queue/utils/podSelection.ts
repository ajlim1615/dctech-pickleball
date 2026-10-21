import { createMatchupFromPod, type MatchingStyle, type MatchPlayer } from "./matchingEngine";

export interface PodEntry<P extends MatchPlayer = MatchPlayer> {
  id: string;
  player_id: string;
  group_id?: string | null;
  player: P;
}

export type PodSelection<E> =
  | { challengers: E[]; stayingWinners: E[] }
  | { error: string; needed: number; available: number };

function skillOf(entry: PodEntry): number {
  return Number(entry.player?.skill_rating || 3.0);
}

/**
 * Picks who goes on court next from the waiting line (in queue order).
 * Pure so the online console and the offline tablet app choose players the same way.
 */
export function selectPod<E extends PodEntry>(
  waiting: E[],
  style: MatchingStyle,
  previousWinnerIds: string[],
  count = 4
): PodSelection<E> {
  // In King of the Court / Winners Stay, the 2 previous winners stay on court and only
  // 2 new challengers are called. Winners are re-queued after each match, so they only
  // stay if both are still present in the waiting line.
  const winnerIds = new Set(previousWinnerIds);
  const winnerEntries = waiting.filter((w) => winnerIds.has(w.player_id));
  const isWinnersStay =
    (style === "winners_stay" || style === "king_queen") &&
    previousWinnerIds.length === 2 &&
    winnerEntries.length === 2;
  const targetCount = isWinnersStay ? 2 : count;
  const pool = isWinnersStay ? waiting.filter((w) => !winnerIds.has(w.player_id)) : waiting;

  if (pool.length < targetCount) {
    return {
      error: `Need ${targetCount} waiting players to start a game (only ${pool.length} in queue).`,
      needed: targetCount,
      available: pool.length,
    };
  }

  let challengers: E[];
  if (pool.length <= targetCount) {
    challengers = [...pool];
  } else if ((style === "skill_separated" || style === "skill_courts") && pool.length >= 6) {
    // Skill-separated: anchor to the first in line, then take the players closest in skill
    const anchor = pool[0];
    const anchorRating = skillOf(anchor);
    const rest = [...pool.slice(1)].sort(
      (a, b) => Math.abs(skillOf(a) - anchorRating) - Math.abs(skillOf(b) - anchorRating)
    );
    challengers = [anchor, ...rest.slice(0, targetCount - 1)];
  } else {
    // First in line, never splitting doubles partners across the cut
    challengers = pool.slice(0, targetCount);
    if (targetCount === 4 && pool.length > 4) {
      const fourth = challengers[3];
      if (fourth.group_id) {
        const partnerIndex = pool.findIndex((w, idx) => idx >= 4 && w.group_id === fourth.group_id);
        if (partnerIndex !== -1) {
          const soloIdx = challengers.findIndex((c) => !c.group_id);
          if (soloIdx !== -1) challengers[soloIdx] = pool[partnerIndex];
        }
      }
    }
  }

  return { challengers, stayingWinners: isWinnersStay ? winnerEntries : [] };
}

/** Splits the chosen players into two teams for the session's matching style. */
export function buildTeams<P extends MatchPlayer>(
  challengers: PodEntry<P>[],
  stayingWinners: PodEntry<P>[],
  style: MatchingStyle,
  random?: () => number
): { teamA: string[]; teamB: string[] } {
  const challengerPlayers = challengers.map((e) => e.player);
  const opts = random ? { random } : {};

  if (stayingWinners.length === 2 && challengerPlayers.length >= 2) {
    // Winners Stay: split the 2 previous winners, each partnered with 1 challenger
    const winners = stayingWinners.map((e) => e.player);
    const matchup = createMatchupFromPod([...winners, ...challengerPlayers], style, winners, opts);
    return { teamA: matchup.teamA.map((p) => p.id), teamB: matchup.teamB.map((p) => p.id) };
  }

  if (challengerPlayers.length >= 4) {
    // A locked doubles pair plays together
    const groups: Record<string, string[]> = {};
    for (const e of challengers) {
      if (e.group_id) (groups[e.group_id] ||= []).push(e.player_id);
    }
    const pairedGroup = Object.values(groups).find((g) => g.length === 2);
    if (pairedGroup) {
      return {
        teamA: pairedGroup,
        teamB: challengers
          .filter((e) => !pairedGroup.includes(e.player_id))
          .map((e) => e.player_id)
          .slice(0, 2),
      };
    }
    const matchup = createMatchupFromPod(challengerPlayers, style, [], opts);
    return { teamA: matchup.teamA.map((p) => p.id), teamB: matchup.teamB.map((p) => p.id) };
  }

  if (challengerPlayers.length === 2) {
    return { teamA: [challengerPlayers[0].id], teamB: [challengerPlayers[1].id] };
  }
  return {
    teamA: [challengerPlayers[0]?.id].filter(Boolean) as string[],
    teamB: challengerPlayers.slice(1).map((p) => p.id),
  };
}
