/** A called player can only be swapped out before anyone has scored. */
export function canSwapNoShow(scoreA: number, scoreB: number): boolean {
  return scoreA === 0 && scoreB === 0;
}

/** The first person in line who isn't already in this game. */
export function pickReplacement(
  waiting: { id: string; player_id: string; joined_at: string }[],
  excludePlayerIds: string[]
): { id: string; player_id: string } | null {
  const excluded = new Set(excludePlayerIds);
  const next = [...waiting]
    .filter((w) => !excluded.has(w.player_id))
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
  return next ? { id: next.id, player_id: next.player_id } : null;
}
