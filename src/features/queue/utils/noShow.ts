/** How long after a game starts a no-show can still be swapped out. */
export const NO_SHOW_WINDOW_MINUTES = 5;

/**
 * A called player can only be swapped out before anyone has scored, and only in the
 * first few minutes (court cards don't always save points as they happen).
 */
export function canSwapNoShow(
  scoreA: number,
  scoreB: number,
  startedAt?: string | null,
  now: Date = new Date()
): boolean {
  if (scoreA !== 0 || scoreB !== 0) return false;
  if (!startedAt) return true;
  return now.getTime() - new Date(startedAt).getTime() < NO_SHOW_WINDOW_MINUTES * 60_000;
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

/**
 * Tries each candidate in order and returns the first one whose claim succeeds,
 * so a player taken by another court or admin a moment earlier is skipped.
 */
export async function claimFirstAvailable<T>(candidates: T[], tryClaim: (candidate: T) => Promise<boolean>): Promise<T | null> {
  for (const candidate of candidates) {
    if (await tryClaim(candidate)) return candidate;
  }
  return null;
}
